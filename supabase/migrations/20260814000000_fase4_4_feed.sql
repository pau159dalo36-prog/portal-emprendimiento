-- FASE 4.4 — Feed "Para ti" + "Siguiendo" (migración NO destructiva)
-- ============================================================================
-- Objetivo: primer feed real de Ideora. `posts` es la unidad de distribución;
-- `videos` sigue siendo la fuente de verdad del contenido, sus estados y su
-- moderación. Se exponen DOS RPCs de lectura SOLO (sin escrituras):
--
--   * get_for_you_feed(...)  → descubrimiento recomendado con ranking
--     determinista y explicable (recencia + afinidad + calidad de visionado +
--     completion + views capeadas + exploración), métricas AGRAGADAS de
--     analytics, cursor estable (final_score, published_at, id).
--   * get_following_feed(...) → contenido de perfiles/proyectos/organizaciones
--     seguidos, cronológico (published_at DESC, id DESC), cursor estable.
--
-- Principios de diseño:
--
--  * POSTS como unidad: ambos feeds parten de `public.posts` distribuibles y
--    estrictamente públicos. La distributividad se deriva del predicado
--    canónico `post_is_publicly_distributable` (que a su vez deriva del vídeo:
--    status='published' + processing='ready' + moderación unreviewed/approved
--    + coherencia de visibilidad). Esto expulsa rejected/flagged/unlisted/
--    private/registered_users/project_members/withdrawn/archived/removed.
--
--  * SECURITY DEFINER JUSTIFICADO: para calcular la afinidad y el score es
--    necesario leer `profile_follows`, `project_follows`,
--    `organization_follows` y `profile_blocks` (sin SELECT para anon) y las
--    métricas agregadas de `video_view_sessions` (tabla sin GRANT ni políticas
--    SELECT). Como invoker, anon/authenticated NO pueden leer ninguna de esas
--    tablas y la RPC fallaría (permission denied). Por eso ambas funciones
--    corren como SECURITY DEFINER con `set search_path = ''`, usan
--    `auth.uid()` INTERNAMENTE (nunca aceptan un user_id de entrada) y
--    re-implementan el predicado de distributividad + visibilidad estricta
--    'public', de modo que un cliente jamás obtiene contenido privado ni
--    protegido a través de la RPC (fail-closed). Patrón idéntico al ya usado
--    por `report_video_view` / `get_*_metrics` / `count_*_followers`.
--
--  * Anónimos: get_for_you_feed funciona para anon con ranking GLOBAL
--    (recencia + métricas agregadas + exploración + diversidad); la afinidad
--    es 0 porque no hay identidad (auth.uid() IS NULL). No se usan IP,
--    fingerprint ni anonymous_session_id del sistema de analytics. La
--    personalización se limita a la afinidad por follows del propio auth.uid().
--
--  * Sin nuevas tablas, triggers ni índices: los índices existentes
--    (posts_listing_idx, posts_author_id_idx, posts_project_id_idx,
--    posts_organization_id_idx, follows *_idx, profile_blocks_*_idx,
--    video_view_sessions_video_id_idx) cubren las consultas con el volumen
--    actual. NO se crean índices redundantes.
--
--  * Anti-manipulación: qualified_views es una señal BLANDA y capeada. El
--    ranking prioriza retención normalizada, completion suavizada, recencia,
--    afinidad limitada y exploración. Una inflación artificial de views no
--    puede mandar un post al top (peso VIEW_CONFIDENCE_WEIGHT = 0.10 y capa
--    log1p/10).
--
--  * Smoothing con pocas muestras (Bayesiano sencillo): la calidad observada
--    (average_progress / completion_rate) se mezcla con un prior razonable
--    mediante el peso de confianza n/(n+PRIOR_VIEWS). Un vídeo con 1 vista al
--    100% NO supera a uno con 100 vistas al 70%: la confianza del primero es
--    ~1/11 y tira del resultado hacia el prior.
--
--  * Diversidad: NO se aplica en SQL (el orden SQL debe ser el orden de rango
--    determinista para el cursor). La capa de aplicación (src/feed/diversity.ts)
--    reordena DENTRO de cada página sin eliminar candidatos.
--
--  * Fórmula final (espejo de src/feed/config.ts):
--      recency   = 0.5^(age_hours / 168)   -- half-life real: 7 días = 0.5
--      affinity  = min(1.0, 0.6*author + 0.4*project + 0.3*org)
--      watch     = smooth(avg_progress,  PRIOR 0.5)
--      completion= smooth(completion_rate, PRIOR 0.3)
--      views     = min(1.0, log1p(qviews) / 10)
--      explore   = exp(-log1p(qviews) / 20)
--      score     = 0.35*recency + 0.15*affinity + 0.20*watch
--                + 0.10*completion + 0.10*views + 0.10*explore
--    score ∈ [0,1], redondeado a 6 decimales (orden y cursor estables).
--    Los componentes se DEVUELVEN en cada fila para explicabilidad/auditoría
--    interna (nunca se muestran al usuario).
--
--  * Paginación por cursor (nunca OFFSET):
--      - Para ti:   tupla (final_score DESC, published_at DESC, id DESC).
--      - Siguiendo: tupla (published_at DESC, id DESC).
--    El cursor es opaco para la UI (la capa de datos lo serializa). Si el
--    score cambia mientras se navega, la tupla sigue siendo determinista y no
--    se generan duplicados en condiciones normales (limitación documentada).

begin;

-- ============================================================================
-- 1. RPC "Para ti"
-- ============================================================================
create or replace function public.get_for_you_feed(
  p_limit integer default 12,
  p_cursor_score numeric default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  post_id uuid,
  post_post_type text,
  post_body text,
  post_created_at timestamptz,
  post_updated_at timestamptz,
  author_id uuid,
  author_full_name text,
  author_username text,
  author_avatar_url text,
  video_id uuid,
  video_title text,
  video_caption text,
  video_thumbnail_path text,
  video_thumbnail_bucket text,
  video_poster_path text,
  video_poster_bucket text,
  video_duration_seconds integer,
  video_width integer,
  video_height integer,
  project_id uuid,
  project_name text,
  project_slug text,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  published_at timestamptz,
  qualified_views bigint,
  plays bigint,
  average_watch_seconds numeric,
  average_progress numeric,
  completion_rate numeric,
  recency_score numeric,
  affinity_score numeric,
  watch_score numeric,
  completion_score numeric,
  views_score numeric,
  exploration_score numeric,
  final_score numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  candidate_posts as (
    select p.*
    from public.posts p
    where p.publication_status = 'published'
      and p.visibility = 'public'
      and public.post_is_publicly_distributable(
            p.publication_status, p.visibility, p.video_id)
      -- Bloqueos en AMBAS direcciones: si yo bloqueo al autor o el autor me
      -- bloquea a mí, su post queda fuera del feed. auth.uid() IS NULL (anon)
      -- no tiene bloqueos que aplicar.
      and not exists (
        select 1 from public.profile_blocks pb
        where auth.uid() is not null
          and (
            (pb.profile_id = auth.uid() and pb.blocked_id = p.author_id)
            or (pb.profile_id = p.author_id and pb.blocked_id = auth.uid())
          )
      )
  ),
  scored as (
    select
      cp.*,
      m.qualified_views,
      m.plays,
      m.average_watch_seconds,
      m.average_progress,
      m.completion_rate,
      -- A) RECENCIA: decay exponencial de media-vida (half-life) 168 h = 7 días.
      --    Un post de 7 días vale 0.5, uno de 14 días 0.25... nunca 0.
      0.5 ^ (greatest(extract(epoch from (now() - cp.published_at)), 0)
          / 3600.0 / 168.0) as recency_score,
      -- B) AFINIDAD limitada (CAP): seguir no = aparecer primero. 0 para anon.
      least(
        1.0,
        0.6 * case when auth.uid() is not null and exists (
              select 1 from public.profile_follows f
              where f.profile_id = auth.uid() and f.following_id = cp.author_id
            ) then 1.0 else 0.0 end
      + 0.4 * case when auth.uid() is not null and cp.project_id is not null
              and exists (
                select 1 from public.project_follows f
                where f.profile_id = auth.uid() and f.project_id = cp.project_id
              ) then 1.0 else 0.0 end
      + 0.3 * case when auth.uid() is not null and cp.organization_id is not null
              and exists (
                select 1 from public.organization_follows f
                where f.profile_id = auth.uid() and f.organization_id = cp.organization_id
              ) then 1.0 else 0.0 end
      ) as affinity_score,
      -- C) CALIDAD DE VISIONADO (métricas agregadas únicamente; nunca
      --    viewer_id / anonymous_session_id / sesiones individuales).
      --    Smoothing bayesiano sencillo: peso n/(n+PRIOR_VIEWS=10).
      --    PRIOR_PROGRESS = 0.5.
      (
        (coalesce(m.qualified_views, 0) / (coalesce(m.qualified_views, 0) + 10.0))
        * coalesce(m.average_progress, 0)
        + (10.0 / (coalesce(m.qualified_views, 0) + 10.0)) * 0.5
      ) as watch_score,
      -- D) COMPLETION suavizada (PRIOR_COMPLETION = 0.3).
      (
        (coalesce(m.qualified_views, 0) / (coalesce(m.qualified_views, 0) + 10.0))
        * coalesce(m.completion_rate, 0)
        + (10.0 / (coalesce(m.qualified_views, 0) + 10.0)) * 0.3
      ) as completion_score,
      -- E) VIEWS como señal PEQUEÑA y capeada (log1p / 10): las vistas brutas
      --    NUNCA dominan el ranking.
      least(1.0, ln(1.0 + coalesce(m.qualified_views, 0)) / 10.0) as views_score,
      -- F) EXPLORACIÓN: los posts nuevos con 0/pocas views compiten. La
      --    saturación con los views evita el rich-get-richer.
      exp(-ln(1.0 + coalesce(m.qualified_views, 0)) / 20.0) as exploration_score
    from candidate_posts cp
    -- Métricas agregadas por vídeo (LEFT JOIN LATERAL: _video_metrics_aggregate
    -- devuelve SIEMPRE una fila, con 0s si no hay sesiones → cold start).
    left join lateral public._video_metrics_aggregate(cp.video_id) m on true
  ),
  ranked as (
    select
      s.*,
      round(
        0.35 * s.recency_score
      + 0.15 * s.affinity_score
      + 0.20 * s.watch_score
      + 0.10 * s.completion_score
      + 0.10 * s.views_score
      + 0.10 * s.exploration_score,
      6
      ) as final_score
    from scored s
  )
  select
    r.id,
    r.post_type,
    r.body,
    r.created_at,
    r.updated_at,
    a.id,
    a.full_name,
    a.username,
    a.avatar_url,
    v.id,
    v.title,
    v.caption,
    v.thumbnail_path,
    v.thumbnail_bucket,
    v.poster_path,
    v.poster_bucket,
    v.duration_seconds,
    v.width,
    v.height,
    pr.id,
    pr.name,
    pr.slug,
    o.id,
    o.name,
    o.slug,
    r.published_at,
    r.qualified_views,
    r.plays,
    r.average_watch_seconds,
    r.average_progress,
    r.completion_rate,
    r.recency_score,
    r.affinity_score,
    r.watch_score,
    r.completion_score,
    r.views_score,
    r.exploration_score,
    r.final_score
  from ranked r
  left join public.profiles a on a.id = r.author_id
  left join public.videos v on v.id = r.video_id
  left join public.projects pr on pr.id = r.project_id
  left join public.organizations o on o.id = r.organization_id
  where p_cursor_score is null
     or (r.final_score < p_cursor_score)
     or (r.final_score = p_cursor_score and r.published_at < p_cursor_published_at)
     or (r.final_score = p_cursor_score and r.published_at = p_cursor_published_at
         and r.id < p_cursor_id)
  order by r.final_score desc, r.published_at desc, r.id desc
  limit greatest(least(coalesce(p_limit, 12), 50), 1);
$$;

-- ============================================================================
-- 2. RPC "Siguiendo"
-- ============================================================================
create or replace function public.get_following_feed(
  p_limit integer default 12,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  post_id uuid,
  post_post_type text,
  post_body text,
  post_created_at timestamptz,
  post_updated_at timestamptz,
  author_id uuid,
  author_full_name text,
  author_username text,
  author_avatar_url text,
  video_id uuid,
  video_title text,
  video_caption text,
  video_thumbnail_path text,
  video_thumbnail_bucket text,
  video_poster_path text,
  video_poster_bucket text,
  video_duration_seconds integer,
  video_width integer,
  video_height integer,
  project_id uuid,
  project_name text,
  project_slug text,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  published_at timestamptz,
  qualified_views bigint,
  plays bigint,
  average_watch_seconds numeric,
  average_progress numeric,
  completion_rate numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  candidates as (
    select p.*
    from public.posts p
    where p.publication_status = 'published'
      and p.visibility = 'public'
      and public.post_is_publicly_distributable(
            p.publication_status, p.visibility, p.video_id)
      -- Solo para usuarios autenticados: anon no recibe feed personalizado.
      and auth.uid() is not null
      -- Entra si coincide con AL MENOS UNO de los seguidos. `posts` tiene una
      -- fila por post → el mismo post aparece UNA sola vez aunque coincida por
      -- autor + proyecto + organización a la vez.
      and (
        exists (
          select 1 from public.profile_follows f
          where f.profile_id = auth.uid() and f.following_id = p.author_id
        )
        or exists (
          select 1 from public.project_follows f
          where f.profile_id = auth.uid() and f.project_id = p.project_id
        )
        or exists (
          select 1 from public.organization_follows f
          where f.profile_id = auth.uid() and f.organization_id = p.organization_id
        )
      )
      -- Bloqueos simétricos (idéntico criterio que "Para ti").
      and not exists (
        select 1 from public.profile_blocks pb
        where (pb.profile_id = auth.uid() and pb.blocked_id = p.author_id)
           or (pb.profile_id = p.author_id and pb.blocked_id = auth.uid())
      )
  )
  select
    p.id,
    p.post_type,
    p.body,
    p.created_at,
    p.updated_at,
    a.id,
    a.full_name,
    a.username,
    a.avatar_url,
    v.id,
    v.title,
    v.caption,
    v.thumbnail_path,
    v.thumbnail_bucket,
    v.poster_path,
    v.poster_bucket,
    v.duration_seconds,
    v.width,
    v.height,
    pr.id,
    pr.name,
    pr.slug,
    o.id,
    o.name,
    o.slug,
    p.published_at,
    m.qualified_views,
    m.plays,
    m.average_watch_seconds,
    m.average_progress,
    m.completion_rate
  from candidates p
  left join public.profiles a on a.id = p.author_id
  left join public.videos v on v.id = p.video_id
  left join public.projects pr on pr.id = p.project_id
  left join public.organizations o on o.id = p.organization_id
  left join lateral public._video_metrics_aggregate(p.video_id) m on true
  where p_cursor_published_at is null
     or (p.published_at < p_cursor_published_at)
     or (p.published_at = p_cursor_published_at and p.id < p_cursor_id)
  order by p.published_at desc, p.id desc
  limit greatest(least(coalesce(p_limit, 12), 50), 1);
$$;

-- ============================================================================
-- 3. Permisos mínimos explícitos (auto_expose_new_tables desactivado)
-- ============================================================================
-- ACL explícita en CUATRO pasos (no dependemos de defaults de Supabase/
-- PostgREST ni de los grants heredados del auto-expose): primero se revoca
-- todo de PUBLIC y de los roles que cuenten como "público por defecto", y solo
-- entonces se conceden los grants previstos. La secuencia completa es
-- idempotente y corrige cualquier grant directo residual sobre anon/
-- authenticated.
--
--   get_for_you_feed:   anon + authenticated (feed público de descubrimiento).
--   get_following_feed: SOLO authenticated (feed personalizado; anon no tiene
--                       EXECUTE → fail-closed por ACL).
--
-- Esta migración NO crea helpers nuevos internos: solo las dos RPC públicas
-- anteriores. Sus dependencias internas (post_is_publicly_distributable,
-- video_is_publicly_distributable y _video_metrics_aggregate) son de fases
-- previas y ya tienen sus propios grants: las dos primeras se revocaron de
-- PUBLIC y se concedieron SOLO a anon, authenticated (necesitan invocarse
-- dentro de las RPC definer); _video_metrics_aggregate no tiene EXECUTE para
-- anon/authenticated (se invoca únicamente desde las funciones SECURITY
-- DEFINER de esta fase, que corren como owner).
revoke execute on function public.get_for_you_feed(integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.get_for_you_feed(integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.get_for_you_feed(integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.get_for_you_feed(integer, numeric, timestamptz, uuid) to anon, authenticated;

revoke execute on function public.get_following_feed(integer, timestamptz, uuid) from public;
revoke execute on function public.get_following_feed(integer, timestamptz, uuid) from anon;
revoke execute on function public.get_following_feed(integer, timestamptz, uuid) from authenticated;
grant execute on function public.get_following_feed(integer, timestamptz, uuid) to authenticated;

commit;
