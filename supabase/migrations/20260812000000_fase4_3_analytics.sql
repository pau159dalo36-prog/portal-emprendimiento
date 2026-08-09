-- FASE 4.3 — Vistas, watch time y métricas reales (migración NO destructiva)
-- ============================================================================
-- Objetivo: medir reproducciones reales de vídeos (plays, qualified views,
-- watch time, progreso, finalizaciones, espectadores únicos y última
-- interacción) sin contadores inflables y sin almacenar millones de eventos.
--
-- Principios de diseño:
--
--  * UNA fila agregada por (identidad, vídeo): `video_view_sessions` guarda la
--    interacción ACUMULADA de cada espectador con cada vídeo. La identidad es
--    `viewer_id` (usuario autenticado) o `anonymous_session_id` (token anónimo
--    efímero). No hay una tabla de eventos por segundo: la unidad mínima de
--    almacenamiento es una sesión agregada por reproducción/espectador, tal y
--    como pide la especificación.
--
--  * Todo el registro de actividad pasa por UNA función `report_video_view`
--    (SECURITY DEFINER). Es la ÚNICA vía de escritura y la única que puede
--    validar: accesibilidad del vídeo, identidad real (auth.uid() frente a token
--    anónimo), anti-inflado (límites por petición, por ventana y totales) e
--    idempotencia (qualified/completed se fijan una sola vez). Estas invariantes
--    NO pueden expresarse como políticas RLS sobre la tabla (no existe una
--    política que vincule el token anónimo de una petición con las filas, ni
--    un CHECK que compare con la fila previa), igual que `can_access_video_storage`
--    y los contadores de follows ya justifican SECURITY DEFINER. La función usa
--    `set search_path = ''` y califica todo como `public.*`.
--
--  * Anti-inflado (tiempo de pared REAL, todo en PostgreSQL):
--      - una sola fila por (identidad, vídeo): refrescar o abrir N veces el mismo
--        vídeo actualiza la MISMA fila; `qualified` se fija una vez y no se repite;
--      - la PRIMERA petición de una sesión nueva solo CREA la fila
--        (watch_seconds = 0): abrir el vídeo por primera vez no cuenta watch time;
--        el tiempo visto empieza a acumularse en las peticiones siguientes
--        (rama UPDATE);
--      - `plays` solo se incrementa si han pasado >= 120 s desde el último
--        checkpoint (refrescos y play/pause rápidos no lo inflan);
--      - el incremento de `watch_seconds` por petición se acota a 60 s (máximo
--        por checkpoint), a `elapsed * MAX_PLAYBACK_RATE + SMALL_GRACE` y a
--        `session_age * MAX_PLAYBACK_RATE − ya contado`:
--          * MAX_PLAYBACK_RATE = 1 (el player no expone velocidades > 1x): solo
--            se puede declarar el tiempo transcurrido REAL, al ritmo real;
--          * SMALL_GRACE = 2,5 s: tolerancia pequeña de red/redondeo por
--            checkpoint (ya NO hay margen +30/+60);
--          * el tope total NO lleva grace: una llamada inmediata no puede
--            "bancar" la tolerancia y una qualified view exige ~3 s reales de
--            pared. Un seek al final no genera watch time falso: el cliente solo
--            envía segundos REALES reproducidos y el servidor además los acota
--            contra el tiempo de pared.
--
--      Fórmula exacta (todo se impone en PostgreSQL, no solo en JS):
--        requested   := coalesce(p_watch_delta, 0)                       -- lo que envía el cliente
--        per-request := least(greatest(requested, 0), MAX_CHECKPOINT_DELTA)  -- 60 s máx por petición
--        window      := least(per-request, elapsed * MAX_PLAYBACK_RATE + SMALL_GRACE) -- 2,5 s de grace
--        total       := least(window, session_age * MAX_PLAYBACK_RATE − ya_contado)  -- SIN grace
--        watch_seconds := watch_seconds + total
--      Con MAX_PLAYBACK_RATE = 1 (el player no expone velocidades > 1x) y
--      SMALL_GRACE = 2,5 s (NO 30/60): una segunda llamada inmediata suma 0,
--      qualified (>= 3 s) exige ~3 s reales de pared y un seek al final no
--      genera completion.
--
--  * Qualified view (criterio definido): una reproducción cuenta como vista
--    cualificada si (a) alcanza >= 3 s reproducidos, o (b) para vídeos muy
--    cortos (<= 10 s) alcanza >= 50 % de progreso con >= 2 s reproducidos.
--    Funciona para vídeos de 5 s, 30 s y 3 min y es idempotente.
--
--  * Completion: se marca cuando max_progress >= 0.95 Y watch_seconds >=
--    min(5 s, 50 % de la duración). No exige el 100 % (players/browsers pueden
--    no llegar al último frame) y no se marca por un seek instantáneo al final.
--
--  * Privacidad anónima: `anonymous_session_id` es un token aleatorio de 128 bits
--    generado en el cliente, efímero (TTL 30 días), no derivado de IP ni de
--    fingerprint, y no se almacenan IPs. Como la tabla no tiene política SELECT
--    ni GRANT, nadie puede enumerar sesiones.
--
--  * Lecturas: métricas AGRUPADAS solo mediante RPCs. Los propietarios ven
--    números agregados (`get_video_metrics` / `get_post_metrics`), nunca
--    identidades de espectadores; el público solo recibe el contador de vistas
--    cualificadas de vídeos distribuibles (`get_public_video_views_count`). Todas
--    son SECURITY DEFINER (necesario para leer la tabla privada) y fail-closed.
--
--  * Sin SECURITY DEFINER en triggers (no hacen falta: la única escritura es la
--    función) y sin tablas de agregados desincronizables: los contadores se
--    derivan por agregación SQL sobre `video_view_sessions` con los índices
--    adecuados para el volumen actual (correcto y simple).
--
--  * Matriz de moderación: `report_video_view` registra watch time únicamente
--    en vídeos públicamente distribuibles ('unreviewed' y 'approved'); en
--    'rejected' / 'flagged' la llamada falla en caliente (fail-closed) y nunca
--    crea filas. Es la misma regla que ya usa la lectura pública de vídeos
--    (`can_access_video_storage`), aplicada también a la escritura de métricas.

begin;

-- ============================================================================
-- 1. Tabla `video_view_sessions`
-- ============================================================================
create table public.video_view_sessions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  viewer_id uuid references public.profiles (id) on delete set null,
  anonymous_session_id text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  plays integer not null default 1,
  watch_seconds numeric(12,2) not null default 0,
  max_progress numeric(5,4) not null default 0,
  qualified boolean not null default false,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Identidad disjunta: autenticado (viewer_id) XOR anónimo (token efímero).
  constraint video_view_sessions_identity_check check (
    (viewer_id is not null and anonymous_session_id is null)
    or (viewer_id is null and anonymous_session_id is not null)
  ),
  constraint video_view_sessions_watch_seconds_check check (watch_seconds >= 0),
  constraint video_view_sessions_plays_check check (plays >= 0),
  constraint video_view_sessions_max_progress_check check (
    max_progress >= 0 and max_progress <= 1
  ),
  -- Token anónimo: aleatorio, no derivado de IP/fingerprint, formato acotado.
  constraint video_view_sessions_anon_format_check check (
    anonymous_session_id is null
    or (
      length(anonymous_session_id) between 16 and 64
      and anonymous_session_id ~ '^[A-Za-z0-9-]+$'
    )
  )
);

-- Unicidad por identidad (los índices parciales tratan los NULLs de Postgres):
-- una fila por (vídeo, viewer_id) y una por (vídeo, anonymous_session_id).
create unique index video_view_sessions_viewer_video_uidx
  on public.video_view_sessions (video_id, viewer_id)
  where viewer_id is not null;

create unique index video_view_sessions_anon_video_uidx
  on public.video_view_sessions (video_id, anonymous_session_id)
  where anonymous_session_id is not null;

-- Índices de consulta (métricas por vídeo y feed futuro). Sin redundancias.
create index video_view_sessions_video_id_idx on public.video_view_sessions (video_id);
create index video_view_sessions_viewer_id_idx on public.video_view_sessions (viewer_id);
create index video_view_sessions_anon_session_idx on public.video_view_sessions (anonymous_session_id);
create index video_view_sessions_post_id_idx on public.video_view_sessions (post_id);
create index video_view_sessions_qualified_idx on public.video_view_sessions (video_id) where qualified;
create index video_view_sessions_recency_idx on public.video_view_sessions (video_id, last_seen_at desc);

-- ============================================================================
-- 2. Helper de accesibilidad para analytics (función normal, invoker)
-- ============================================================================
-- Decide si la identidad actual (auth.uid()) puede registrar actividad en un
-- vídeo. Devuelve:
--   'owner'   → el llamante es el propietario (nunca se registran auto-vistas)
--   'ok'      → distribuible y visible para el llamante
--   'denied'  → no visible / no distribuible / no existe
-- Reutiliza el predicado canónico `video_is_publicly_distributable` (la ÚNICA
-- fuente de verdad de moderación) y los helpers de membresía existentes, de
-- modo que la decisión de analytics no puede divergir de la de reproducción.
create or replace function public.video_analytics_access(p_video_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when v.owner_id = auth.uid() then 'owner'
    when v.status = 'published'
         and v.processing_status = 'ready'
         and public.video_is_publicly_distributable(v.moderation_status)
         and case v.visibility
           when 'public' then true
           when 'unlisted' then true
           when 'registered_users' then auth.uid() is not null
           when 'project_members' then v.project_id is not null and public.is_project_member(v.project_id)
           when 'private' then false
           else false
         end
    then 'ok'
    else 'denied'
  end
  from public.videos v
  where v.id = p_video_id;
$$;

-- ============================================================================
-- 3. Registro de actividad (única vía de escritura)
-- ============================================================================
create or replace function public.report_video_view(
  p_video_id uuid,
  p_anonymous_session_id text default null,
  p_watch_delta numeric default 0,
  p_progress numeric default 0
)
returns table (
  qualified boolean,
  completed boolean,
  watch_seconds numeric,
  max_progress numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access text;
  v_viewer_id uuid := null;
  v_session_id uuid := null;
  v_old_watch numeric := 0;
  v_old_progress numeric := 0;
  v_last_seen timestamptz := now();
  v_started timestamptz := now();
  v_plays integer := 0;
  v_duration integer := null;
  v_elapsed numeric := 0;
  v_total_elapsed numeric := 0;
  v_delta numeric := 0;
  v_new_watch numeric := 0;
  v_new_progress numeric := 0;
  v_new_qualified boolean := false;
  v_new_completed boolean := false;
  -- Constantes de anti-inflado (espejo de src/analytics/config.ts): el player
  -- no expone velocidades > 1x (no hay control de playbackRate), así que
  -- MAX_PLAYBACK_RATE = 1; SMALL_GRACE es solo la tolerancia de red/redondeo
  -- (2,5 s, NO 30/60) y MAX_CHECKPOINT_DELTA el máximo por petición.
  v_max_playback_rate numeric := 1;
  v_max_checkpoint_delta numeric := 60;
  v_small_grace numeric := 2.5;
begin
  -- 1) Accesibilidad y exclusión de auto-vistas (fail-closed, sin fugas).
  v_access := public.video_analytics_access(p_video_id);
  if v_access is null or v_access in ('denied', 'owner') then
    return;
  end if;

  -- 2) Identidad real: autenticado => viewer_id siempre auth.uid(); anónimo =>
  --    token efímero obligatorio y bien formado (nunca se usa IP/fingerprint).
  if auth.uid() is not null then
    v_viewer_id := auth.uid();
  else
    if p_anonymous_session_id is null
       or length(p_anonymous_session_id) < 16
       or length(p_anonymous_session_id) > 64
       or p_anonymous_session_id !~ '^[A-Za-z0-9-]+$' then
      return;
    end if;
  end if;

  -- 3) Sesión existente: UNA fila por (identidad, vídeo). El anónimo solo puede
  --    encontrar (y por tanto actualizar) su propia fila, la de su token.
  select s.id, s.watch_seconds, s.max_progress, s.last_seen_at, s.started_at,
         s.plays, s.qualified, s.completed
    into v_session_id, v_old_watch, v_old_progress, v_last_seen, v_started,
         v_plays, v_new_qualified, v_new_completed
    from public.video_view_sessions s
    where s.video_id = p_video_id
      and (
        (v_viewer_id is not null and s.viewer_id = v_viewer_id)
        or (v_viewer_id is null and s.anonymous_session_id = p_anonymous_session_id)
      );

  -- 4) Duración real del vídeo (la BD es la fuente de verdad, no el cliente).
  select duration_seconds into v_duration
    from public.videos
    where id = p_video_id;

  -- 5) Clamps de watch time (anti-inflado, en tiempo de pared REAL):
  --    * por petición: nunca más de 60 s (máximo por checkpoint);
  --    * por ventana: delta <= elapsed * MAX_PLAYBACK_RATE + SMALL_GRACE;
  --    * total: watch_seconds <= session_age * MAX_PLAYBACK_RATE (sin grace).
  --    MAX_PLAYBACK_RATE = 1 (el player no expone velocidades > 1x) y
  --    SMALL_GRACE = 2,5 s (latencia/redondeo). Un cliente no puede declarar
  --    más tiempo visto que el transcurrido REAL, y una llamada inmediata solo
  --    suma 0 (el tope total no deja "bancar" la tolerancia).
  v_elapsed := greatest(extract(epoch from (now() - v_last_seen)), 0);
  v_total_elapsed := greatest(extract(epoch from (now() - v_started)), 0);

  v_delta := least(greatest(coalesce(p_watch_delta, 0), 0), v_max_checkpoint_delta);
  v_delta := least(v_delta, v_elapsed * v_max_playback_rate + v_small_grace);
  v_delta := least(v_delta, greatest(v_total_elapsed * v_max_playback_rate - v_old_watch, 0));

  v_new_watch := v_old_watch + v_delta;
  v_new_progress := greatest(v_old_progress, least(greatest(coalesce(p_progress, 0), 0), 1));

  -- 6) Qualified view (idempotente) y completion.
  v_new_qualified := v_new_qualified
    or v_new_watch >= 3
    or (v_duration is not null and v_duration <= 10
        and v_new_progress >= 0.5 and v_new_watch >= 2);

  v_new_completed := v_new_completed
    or (v_new_progress >= 0.95
        and v_new_watch >= least(5, coalesce(v_duration, 10) * 0.5));

  -- 7) Upsert agregado (nunca se crean filas duplicadas).
  if v_session_id is null then
    -- PRIMERA petición de una sesión nueva: solo se CREA la fila. El watch time
    -- de esta primera petición NO se acumula (watch_seconds = 0): abrir o
    -- refrescar el vídeo por primera vez no cuenta tiempo visto. El tiempo
    -- empieza a sumarse en las peticiones siguientes (rama UPDATE). Al no haber
    -- watch acumulado, la sesión recién creada nunca arranca qualified/completed
    -- (los umbrales exigen watch_seconds >= 2/3 y >= 5 como mínimo).
    insert into public.video_view_sessions (
      video_id, post_id, viewer_id, anonymous_session_id,
      started_at, last_seen_at, plays, watch_seconds, max_progress, qualified, completed
    )
    values (
      p_video_id,
      (select id from public.posts where video_id = p_video_id limit 1),
      v_viewer_id,
      case when v_viewer_id is null then p_anonymous_session_id else null end,
      now(), now(), 1,
      0, round(v_new_progress, 4),
      false, false
    );
  else
    update public.video_view_sessions
    set last_seen_at = now(),
        post_id = coalesce(
          (select id from public.posts where video_id = p_video_id limit 1),
          post_id
        ),
        -- `plays` solo crece si pasaron >= 120 s desde el último checkpoint
        -- (un refresh o play/pause rápidos NO incrementan reproducciones).
        plays = case when v_elapsed >= 120 then plays + 1 else plays end,
        watch_seconds = round(v_new_watch, 2),
        max_progress = round(v_new_progress, 4),
        qualified = v_new_qualified,
        completed = v_new_completed
    where id = v_session_id;
  end if;

  return query
    select v_new_qualified, v_new_completed, round(v_new_watch, 2), round(v_new_progress, 4);
end;
$$;

-- ============================================================================
-- 4. Lecturas agregadas (RPCs SECURITY DEFINER, SOLO números)
-- ============================================================================
-- Agregación interna (sin comprobación de propiedad): la usan las RPCs públicas.
-- No se concede EXECUTE a nadie (ni siquiera vía public): es puramente interna.
create or replace function public._video_metrics_aggregate(p_video_id uuid)
returns table (
  qualified_views bigint,
  plays bigint,
  unique_viewers bigint,
  total_watch_seconds numeric,
  average_watch_seconds numeric,
  completion_rate numeric,
  average_progress numeric,
  last_interaction timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    count(*) filter (where s.qualified)::bigint,
    coalesce(sum(s.plays), 0)::bigint,
    count(*)::bigint,
    coalesce(round(sum(s.watch_seconds), 2), 0),
    case when count(*) = 0 then 0 else round(sum(s.watch_seconds) / count(*), 2) end,
    case when count(*) = 0 then 0 else (count(*) filter (where s.completed))::numeric / count(*) end,
    case when count(*) = 0 then 0 else avg(s.max_progress) end,
    max(s.last_seen_at)
  from public.video_view_sessions s
  where s.video_id = p_video_id;
$$;

-- Métricas AGRUPADAS para el propietario (o admin). Nunca identidades de
-- espectadores. Fail-closed: un no propietario recibe una fila vacía (0 filas).
create or replace function public.get_video_metrics(p_video_id uuid)
returns table (
  qualified_views bigint,
  plays bigint,
  unique_viewers bigint,
  total_watch_seconds numeric,
  average_watch_seconds numeric,
  completion_rate numeric,
  average_progress numeric,
  last_interaction timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public._video_metrics_aggregate(p_video_id)
  where exists (
    select 1 from public.videos v
    where v.id = p_video_id
      and (v.owner_id = auth.uid() or public.is_platform_admin())
  );
$$;

-- Igual, pero a partir del post de vídeo (autor del post = propietario del
-- vídeo por `posts_validate_video_ownership`).
create or replace function public.get_post_metrics(p_post_id uuid)
returns table (
  qualified_views bigint,
  plays bigint,
  unique_viewers bigint,
  total_watch_seconds numeric,
  average_watch_seconds numeric,
  completion_rate numeric,
  average_progress numeric,
  last_interaction timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public._video_metrics_aggregate(
    (select p.video_id from public.posts p where p.id = p_post_id)
  )
  where exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and (p.author_id = auth.uid() or public.is_platform_admin())
  );
$$;

-- Contador público de vistas cualificadas: solo para vídeos públicamente
-- distribuibles (published + ready + distributable + visibility pública/
-- unlisted). Devuelve 0 para el resto (no es un vector para sondear IDs).
create or replace function public.get_public_video_views_count(p_video_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where s.qualified)
  from public.video_view_sessions s
  where s.video_id = p_video_id
    and exists (
      select 1 from public.videos v
      where v.id = p_video_id
        and v.status = 'published'
        and v.processing_status = 'ready'
        and public.video_is_publicly_distributable(v.moderation_status)
        and v.visibility in ('public', 'unlisted')
    );
$$;

-- ============================================================================
-- 5. Row Level Security — `video_view_sessions`
-- ============================================================================
-- Privacidad máxima: la tabla NO tiene políticas SELECT/INSERT/UPDATE/DELETE ni
-- GRANT. Nadie (ni siquiera el propio usuario) lee filas de sesión directamente:
-- las únicas lecturas son las RPCs agregadas SECURITY DEFINER y la única
-- escritura es `report_video_view`. Un cliente no puede inventarse métricas,
-- modificar sesiones ajenas ni marcar 10.000 segundos vistos.
alter table public.video_view_sessions enable row level security;

-- ============================================================================
-- 6. Permisos mínimos (auto_expose_new_tables desactivado)
-- ============================================================================
grant usage on schema public to anon, authenticated;

-- Funciones de trigger/helper internos: no invocables directamente.
revoke execute on function public.video_analytics_access(uuid) from public;
revoke execute on function public._video_metrics_aggregate(uuid) from public;

-- RPC de registro: ejecutable por anon y authenticated (única vía de escritura).
revoke execute on function public.report_video_view(uuid, text, numeric, numeric) from public;
grant execute on function public.report_video_view(uuid, text, numeric, numeric) to anon, authenticated;

-- Métricas agregadas del propietario: solo authenticated.
revoke execute on function public.get_video_metrics(uuid) from public;
grant execute on function public.get_video_metrics(uuid) to authenticated;
revoke execute on function public.get_post_metrics(uuid) from public;
grant execute on function public.get_post_metrics(uuid) to authenticated;

-- Contador público: anon y authenticated.
revoke execute on function public.get_public_video_views_count(uuid) from public;
grant execute on function public.get_public_video_views_count(uuid) to anon, authenticated;

commit;
