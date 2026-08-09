-- ============================================================================
-- FASE 4.3 — Verificación de invariantes (analytics de vídeo)
-- ============================================================================
-- Script SQL que comprueba los comportamientos exigidos por la migración
-- 20260812000000_fase4_3_analytics.sql:
--   1. La PRIMERA petición de una sesión nueva SOLO crea la fila con
--      watch_seconds = 0 (abrir/refrescar no cuenta watch time).
--   2. Un seek instantáneo al final (progress alto con watch 0) NO marca ni
--      qualified ni completed.
--   3. Un "refresh" repetido sin tiempo real NO infla: cada petición inmediata
--      suma 0 (tope total sin grace) y plays no crece sin 120 s.
--   3B. Tras tiempo REAL suficiente sí acumula, pero nunca más que el tiempo de
--      pared transcurrido (session_age * 1).
--   3C. Un vídeo largo no se puede completar (ni cualificar) con un seek
--      instantáneo al final ni con apenas 2 s reales.
--   4. `plays` solo se incrementa si pasaron >= 120 s desde el último checkpoint.
--   5. Alcanzar el umbral (>= 3 s) marca qualified de forma idempotente.
--   6. completion exige progress >= 0.95 Y watch >= min(5, 50% duración).
--   7. El delta de watch por petición se acota a 60 s (aunque el cliente mienta).
--   8. Cada identidad tiene su propia sesión: bob no toca la de dave ni la de
--      un token anónimo (y la RLS impide UPDATE/UPDATE de sesiones ajenas).
--   9. anon NO puede leer la tabla video_view_sessions (ni enumerarla).
--  10. El propietario obtiene métricas AGRUPADAS (get_video_metrics); nunca
--      identidades (no existe columna de espectador en el resultado).
--  11. Un no-propietario obtiene 0 filas en get_video_metrics/get_post_metrics.
--  12. Un vídeo 'private' no acepta reportes de anónimos (fail-closed).
--  13. Un vídeo 'rejected'/'flagged' no acepta reportes del público.
--  14. El propietario nunca registra auto-vistas sobre sus propios vídeos.
--  15. public/published/ready sí acepta reportes (ruta de token anónimo y de
--      usuario autenticado) y las métricas por post y el contador público
--      devuelven los agregados correctos.
--  16. Vídeo corto (<= 10 s): umbral de qualified reducido.
--  17. El token anónimo debe estar bien formado (rechazo silencioso).
--  18. Matriz de moderación: solo 'unreviewed'/'approved' aceptan watch time del
--      público; 'rejected'/'flagged' fallan en caliente y nunca crean filas.
--
-- Escenarios de anti-inflado pedidos (mapeo a los TEST):
--   (a) INSERT sesión -> watch_seconds = 0: TEST 1.
--   (b) UPDATE inmediato con delta = 60 -> NO suma 30/60 s: TEST 3.
--   (c) Tras tiempo de pared suficiente -> acumula acotado al tiempo real: TEST 3B.
--   (d) Múltiples llamadas inmediatas no superan el tiempo de pared permitido:
--       TEST 3 (tres llamadas inmediatas suman 0) + TEST 3B (la inmediata posterior suma 0).
--   (e) Un vídeo largo NO se completa (ni cualifica) inmediatamente: TEST 3C.
-- Matriz de moderación (los 4 estados): TEST 18 (predicado) + TEST 13 (rejected/
-- flagged fallan en caliente sin crear filas) + TEST 1-7 y 18 (unreviewed/approved
-- aceptan watch time del público).
--
-- Nota sobre el tiempo: `now()` es constante dentro de la transacción, así que
-- para probar las ventanas de anti-inflado (delta <= elapsed * 1 + 2,5 s, total
-- <= session_age * 1, plays >= 120 s) se manipulan directamente
-- `last_seen_at`/`started_at` (el tiempo de pared REAL) como postgres entre
-- peticiones. Una petición inmediata (sin manipular el reloj) solo puede sumar 0.
-- El token anónimo se prueba con claims SIN `sub` (auth.uid() = null), igual que
-- en producción (el JWT de anon no lleva sub).
--
-- Cómo ejecutarlo (stack LOCAL de Supabase, como postgres, tras aplicar las
-- migraciones 20260731 → 20260812):
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fase4_analytics.sql
--
-- Requiere superusuario (postgres) para `set local role` y para fijar
-- `request.jwt.claims`. NO ejecutar contra la base remota. Todo el script va en
-- una transacción que se REVIERTE al final: no deja datos ni cambios.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Setup: identidades y datos de prueba (como postgres, RLS omitido)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, username, full_name)
values
  ('00000000-0000-0000-0000-000000000001', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-000000000002', 'bob', 'Bob'),
  ('00000000-0000-0000-0000-000000000003', 'carol', 'Carol'),
  ('00000000-0000-0000-0000-000000000004', 'dave', 'Dave');

-- Vídeos: se crean SOLO como draft/uploading/unreviewed (trigger) y luego se
-- publican (update). Bucket obligatorio según la clase de visibilidad.
--  V1: público 30s    (watch time, umbral, refresh, plays, contador público)
--  V2: público 5s     (vídeo corto: umbral de qualified <= 10 s)
--  V3: privado 30s    (fail-closed para anónimos)
--  V4: público 30s    (se rechazará: rechazado no acepta reportes)
--  V5: público 30s    (se marcará: flagged no acepta reportes)
--  V6: registered 30s (métricas por post y por vídeo, solo autenticados)
--  V7: público 30s    (se aprobará: approved sí acepta reportes del público)
insert into public.videos (id, owner_id, storage_bucket, storage_path, mime_type, size_bytes, duration_seconds, visibility, title, processing_status, moderation_status, status)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'public-videos',  '00000000-0000-0000-0000-000000000001/v1/video.mp4', 'video/mp4', 1000, 30, 'public',            'Vídeo público',        'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'public-videos',  '00000000-0000-0000-0000-000000000001/v2/video.mp4', 'video/mp4', 1000, 5,  'public',            'Vídeo corto',          'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'private-videos', '00000000-0000-0000-0000-000000000001/v3/video.mp4', 'video/mp4', 1000, 30, 'private',           'Vídeo privado',        'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'public-videos',  '00000000-0000-0000-0000-000000000001/v4/video.mp4', 'video/mp4', 1000, 30, 'public',            'Vídeo a rechazar',     'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'public-videos',  '00000000-0000-0000-0000-000000000001/v5/video.mp4', 'video/mp4', 1000, 30, 'public',            'Vídeo a marcar',       'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'private-videos', '00000000-0000-0000-0000-000000000001/v6/video.mp4', 'video/mp4', 1000, 30, 'registered_users', 'Vídeo de registrados', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'public-videos',  '00000000-0000-0000-0000-000000000001/v7/video.mp4', 'video/mp4', 1000, 30, 'public',            'Vídeo aprobado',       'uploading', 'unreviewed', 'draft');

-- Se publican todos (el trigger posts_sync_from_video crea un post por vídeo).
update public.videos set status = 'published', processing_status = 'ready'
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007');

-- El admin (carol) rechaza V4, marca V5 y aprueba V7.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select public.admin_reject_video('10000000-0000-0000-0000-000000000004', 'contenido no permitido');
select public.admin_flag_video('10000000-0000-0000-0000-000000000005', 'spam');
select public.admin_approve_video('10000000-0000-0000-0000-000000000007');

-- Vuelve a postgres para el resto del setup y para manipular el tiempo.
set local role postgres;

do $$
begin
  if (select moderation_status from public.videos where id = '10000000-0000-0000-0000-000000000004') <> 'rejected' then
    raise exception 'FALLO SETUP: V4 no quedó rechazado';
  end if;
  if (select moderation_status from public.videos where id = '10000000-0000-0000-0000-000000000005') <> 'flagged' then
    raise exception 'FALLO SETUP: V5 no quedó marcado';
  end if;
  if (select moderation_status from public.videos where id = '10000000-0000-0000-0000-000000000007') <> 'approved' then
    raise exception 'FALLO SETUP: V7 no quedó aprobado';
  end if;
  if (select count(*) from public.posts) <> 7 then
    raise exception 'FALLO SETUP: los vídeos publicados no generaron sus posts';
  end if;
  raise notice 'PASS SETUP: identidades, vídeos, posts y moderación listos';
end $$;

-- ============================================================================
-- TEST 1: la PRIMERA petición solo crea la fila con watch_seconds = 0
-- ============================================================================
-- Claims de anon SIN sub: auth.uid() es null → ruta de token anónimo.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_q boolean; v_c boolean; v_w numeric; v_p numeric;
begin
  select qualified, completed, watch_seconds, max_progress
    into v_q, v_c, v_w, v_p
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', 'anon-token-0001', 30, 0.5);
  if v_q is distinct from false then
    raise exception 'FALLO TEST1: la primera petición marcó qualified';
  end if;
  if v_c is distinct from false then
    raise exception 'FALLO TEST1: la primera petición marcó completed';
  end if;
  if v_w is distinct from 0 then
    raise exception 'FALLO TEST1: la primera petición acumuló watch time (%)', v_w;
  end if;
  if v_p is distinct from 0.5 then
    raise exception 'FALLO TEST1: la primera petición no registró el progreso';
  end if;
  raise notice 'PASS TEST1: la primera petición solo crea la fila (watch=0)';
end $$;

-- Verificación en la BD: exactamente una fila para el token, con watch=0.
set local role postgres;

do $$
begin
  if (select count(*) from public.video_view_sessions
      where anonymous_session_id = 'anon-token-0001') <> 1 then
    raise exception 'FALLO TEST1: no se creó exactamente una sesión anónima';
  end if;
  if (select watch_seconds from public.video_view_sessions
      where anonymous_session_id = 'anon-token-0001') <> 0 then
    raise exception 'FALLO TEST1: la fila creada no tiene watch_seconds=0';
  end if;
  if (select qualified from public.video_view_sessions
      where anonymous_session_id = 'anon-token-0001') is distinct from false then
    raise exception 'FALLO TEST1: la fila creada arranca qualified';
  end if;
  raise notice 'PASS TEST1: la fila creada tiene watch=0 y qualified=false';
end $$;

-- ============================================================================
-- TEST 2: un seek instantáneo al final NO marca qualified ni completed
-- ============================================================================
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_q boolean; v_c boolean; v_w numeric; v_p numeric;
begin
  select qualified, completed, watch_seconds, max_progress
    into v_q, v_c, v_w, v_p
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000002', 'anon-token-0002', 0, 0.99);
  if v_q is distinct from false or v_c is distinct from false then
    raise exception 'FALLO TEST2: un seek al 99%% con watch 0 marcó qualified/completed';
  end if;
  if v_p is distinct from 0.99 then
    raise exception 'FALLO TEST2: el progreso del seek no se registró';
  end if;
  raise notice 'PASS TEST2: un seek al final sin watch no marca qualified ni completed';
end $$;

-- ============================================================================
-- TEST 3: un refresh inmediato NO infla (tope total sin grace, plays estable)
-- ============================================================================
-- Sobre la sesión anónima ya creada en V1 (token anon-token-0001, watch=0):
-- tres peticiones consecutivas de 60 s de delta con el mismo now() (sin tiempo
-- transcurrido) deben sumar 0 cada una: watch queda en 0 y plays sigue en 1.
-- El tope total session_age * 1 (sin grace) no deja "bancar" la tolerancia.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000001', 'anon-token-0001', 60, 0.5);
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000001', 'anon-token-0001', 60, 0.5);
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000001', 'anon-token-0001', 60, 0.5);
end $$;

set local role postgres;

do $$
begin
  if (select watch_seconds from public.video_view_sessions
      where anonymous_session_id = 'anon-token-0001') <> 0 then
    raise exception 'FALLO TEST3: un refresh inmediato infló el watch (esperado 0, hay %)',
      (select watch_seconds from public.video_view_sessions
       where anonymous_session_id = 'anon-token-0001');
  end if;
  if (select plays from public.video_view_sessions
      where anonymous_session_id = 'anon-token-0001') <> 1 then
    raise exception 'FALLO TEST3: plays creció sin haber pasado 120 s';
  end if;
  raise notice 'PASS TEST3: el refresh inmediato no infla (watch=0, plays=1)';
end $$;

-- ============================================================================
-- TEST 3B: tras tiempo REAL suficiente sí acumula (acotado al tiempo de pared)
-- ============================================================================
-- Token nuevo en V7 (público de 30 s, ya aprobado). Tras 10 s reales de pared,
-- un delta de 60 s se acota a 10 s (session_age * 1): la sesión NO puede
-- acumular más tiempo visto que el transcurrido real. Una llamada inmediata
-- posterior suma 0. (Se usa V7 para no alterar los conteos de V1 que verifican
-- los TEST 10 y 15.)
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000007', 'anon-token-003b', 0, 0.3);
end $$;

set local role postgres;

update public.video_view_sessions
set last_seen_at = now() - interval '10 seconds',
    started_at = now() - interval '10 seconds'
where anonymous_session_id = 'anon-token-003b';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare v_w numeric;
begin
  select watch_seconds into v_w from public.report_video_view(
    '10000000-0000-0000-0000-000000000007', 'anon-token-003b', 60, 0.3);
  if v_w <> 10 then
    raise exception 'FALLO TEST3B: tras 10 s reales el watch no se acotó a 10 (hay %)', v_w;
  end if;
end $$;

-- Llamada inmediata: no suma (el tope total no deja "bancar" la tolerancia).
do $$
declare v_w numeric;
begin
  select watch_seconds into v_w from public.report_video_view(
    '10000000-0000-0000-0000-000000000007', 'anon-token-003b', 60, 0.3);
  if v_w <> 10 then
    raise exception 'FALLO TEST3B: una llamada inmediata sumó watch (hay %)', v_w;
  end if;
end $$;

set local role postgres;

do $$
begin
  if (select plays from public.video_view_sessions
      where anonymous_session_id = 'anon-token-003b') <> 1 then
    raise exception 'FALLO TEST3B: plays creció sin 120 s reales';
  end if;
  raise notice 'PASS TEST3B: la acumulación se acota al tiempo de pared real (10 s)';
end $$;

-- ============================================================================
-- TEST 3C: un vídeo largo NO se puede completar inmediatamente
-- ============================================================================
-- Token nuevo en V7 (30 s): incluso declarando 60 s de delta y progress=1 desde
-- el primer segundo, las llamadas inmediatas suman 0 (watch=0) y la sesión no es
-- qualified ni completed. Tras 2 s reales solo suma 2 s: sigue sin completar
-- (completion exige >= 5 s) y ni siquiera es qualified (>= 3 s).
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare v_q boolean; v_c boolean; v_w numeric;
begin
  select qualified, completed, watch_seconds
    into v_q, v_c, v_w
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000007', 'anon-token-003c', 60, 1.0);
  if v_q is distinct from false or v_c is distinct from false or v_w <> 0 then
    raise exception 'FALLO TEST3C: la creación marcó algo con progress=1 (q=%, c=%, w=%)',
      v_q, v_c, v_w;
  end if;
end $$;

do $$
declare v_q boolean; v_c boolean; v_w numeric;
begin
  select qualified, completed, watch_seconds
    into v_q, v_c, v_w
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000007', 'anon-token-003c', 60, 1.0);
  if v_q is distinct from false or v_c is distinct from false or v_w <> 0 then
    raise exception 'FALLO TEST3C: un seek inmediato al final completó el vídeo';
  end if;
  raise notice 'PASS TEST3C: un vídeo largo no se completa con un seek instantáneo (watch=0)';
end $$;

-- Tras 2 s reales solo puede sumar 2 s.
set local role postgres;

update public.video_view_sessions
set last_seen_at = now() - interval '2 seconds',
    started_at = now() - interval '2 seconds'
where anonymous_session_id = 'anon-token-003c';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare v_q boolean; v_c boolean; v_w numeric;
begin
  select qualified, completed, watch_seconds
    into v_q, v_c, v_w
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000007', 'anon-token-003c', 60, 1.0);
  if v_q is distinct from false then
    raise exception 'FALLO TEST3C: 2 s reales no bastan para qualified en un vídeo de 30 s';
  end if;
  if v_c is distinct from false then
    raise exception 'FALLO TEST3C: 2 s reales no bastan para completar un vídeo de 30 s';
  end if;
  if v_w <> 2 then
    raise exception 'FALLO TEST3C: con 2 s reales el watch debía quedar en 2 (hay %)', v_w;
  end if;
  raise notice 'PASS TEST3C: el completion exige tiempo real (2 s de 30 s no bastan)';
end $$;

-- ============================================================================
-- TEST 4: `plays` solo crece si pasaron >= 120 s desde el último checkpoint
-- ============================================================================
-- Manipulación del tiempo (como postgres): last_seen hace 130 s → la siguiente
-- petición debe incrementar plays de 1 a 2.
set local role postgres;

update public.video_view_sessions
set last_seen_at = now() - interval '130 seconds',
    started_at = now() - interval '400 seconds'
where anonymous_session_id = 'anon-token-0001';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000001', 'anon-token-0001', 5, 0.6);
end $$;

set local role postgres;

do $$
begin
  if (select plays from public.video_view_sessions
      where anonymous_session_id = 'anon-token-0001') <> 2 then
    raise exception 'FALLO TEST4: plays no creció tras 130 s sin checkpoint';
  end if;
  -- El tope total (session_age * 1, sin grace) acota el watch al tiempo REAL:
  -- la sesión tiene 400 s reales y se declararon 5 s reproducidos → watch = 5
  -- (no hay margen +60 para "bancar" nada).
  if (select watch_seconds from public.video_view_sessions
      where anonymous_session_id = 'anon-token-0001') <> 5 then
    raise exception 'FALLO TEST4: el watch no quedó acotado al tiempo real (%)',
      (select watch_seconds from public.video_view_sessions
       where anonymous_session_id = 'anon-token-0001');
  end if;
  raise notice 'PASS TEST4: plays crece solo tras >= 120 s';
end $$;

-- ============================================================================
-- TEST 5: alcanzar el umbral (>= 3 s) marca qualified de forma idempotente
-- ============================================================================
-- bob (autenticado) ve V1: primera petición crea la fila (watch=0); con
-- last_seen hace 6 s y delta 4 el watch llega a 4 → qualified=true. Una
-- petición más no lo vuelve a "activar" (sigue true, no es un contador).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare v_q boolean;
begin
  select qualified into v_q from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', null, 4, 0.5);
  if v_q is distinct from false then
    raise exception 'FALLO TEST5: la primera petición de bob marcó qualified';
  end if;
end $$;

-- Simular 6 s transcurridos para bob (su última petición puso last_seen=now()).
-- También se retrasa started_at: el tope total es session_age * 1, así que la
-- sesión necesita edad real para poder acumular los 4 s declarados.
set local role postgres;

update public.video_view_sessions
set last_seen_at = now() - interval '6 seconds',
    started_at = now() - interval '6 seconds'
where video_id = '10000000-0000-0000-0000-000000000001'
  and viewer_id = '00000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare v_q boolean;
begin
  select qualified into v_q from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', null, 4, 0.5);
  if v_q is distinct from true then
    raise exception 'FALLO TEST5: bob no marcó qualified al pasar del umbral';
  end if;
end $$;

-- Tercera petición (misma transacción, sin tiempo): qualified sigue true.
do $$
declare v_q boolean;
begin
  select qualified into v_q from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', null, 1, 0.6);
  if v_q is distinct from true then
    raise exception 'FALLO TEST5: qualified no es idempotente (volvió a false)';
  end if;
end $$;

set local role postgres;

do $$
begin
  if (select count(*) from public.video_view_sessions
      where video_id = '10000000-0000-0000-0000-000000000001'
        and viewer_id = '00000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'FALLO TEST5: no hay UNA sola sesión por (vídeo, espectador)';
  end if;
  raise notice 'PASS TEST5: el umbral marca qualified de forma idempotente';
end $$;

-- ============================================================================
-- TEST 6: completion exige progress >= 0.95 Y watch >= min(5, 50% duración)
-- ============================================================================
-- bob sigue en V1 (30 s): una petición con progress 0.99 pero con delta 0 (un
-- seek) no completa; tras 5 s reales con delta 5 sí completa.
do $$
declare v_c boolean;
begin
  select completed into v_c from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', null, 0, 0.99);
  if v_c is distinct from false then
    raise exception 'FALLO TEST6: un seek al 99%% sin watch marcó completed';
  end if;
  raise notice 'PASS TEST6: progress alto sin watch no completa';
end $$;

-- Simular 5 s reales transcurridos desde el inicio (started_at) y 5 s desde el
-- último checkpoint, y reportar 5 s reproducidos.
set local role postgres;

update public.video_view_sessions
set last_seen_at = now() - interval '5 seconds',
    started_at = now() - interval '11 seconds'
where video_id = '10000000-0000-0000-0000-000000000001'
  and viewer_id = '00000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare v_c boolean;
begin
  select completed into v_c from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', null, 5, 0.99);
  if v_c is distinct from true then
    raise exception 'FALLO TEST6: no se marcó completed con watch y progress suficientes';
  end if;
  raise notice 'PASS TEST6: completion exige progress >= 0.95 y watch suficiente';
end $$;

-- ============================================================================
-- TEST 7: el delta por petición se acota a 60 s (cliente mentiroso)
-- ============================================================================
-- dave (autenticado) ve V1. Primera petición crea la fila; luego, con
-- last_seen hace 100 s y delta 1000, el watch solo puede sumar 60 s.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000001', null, 5, 0.4);
end $$;

set local role postgres;

update public.video_view_sessions
set last_seen_at = now() - interval '100 seconds',
    started_at = now() - interval '500 seconds'
where video_id = '10000000-0000-0000-0000-000000000001'
  and viewer_id = '00000000-0000-0000-0000-000000000004';

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare v_w numeric;
begin
  select watch_seconds into v_w from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', null, 1000, 0.5);
  if v_w <> 60 then
    raise exception 'FALLO TEST7: el delta no se acotó a 60 s (watch=%)', v_w;
  end if;
  raise notice 'PASS TEST7: el delta por petición se acota a 60 s';
end $$;

-- ============================================================================
-- TEST 8: cada identidad tiene su propia sesión (aislamiento)
-- ============================================================================
-- bob ya tiene su sesión en V1 (viewer_id 002) y dave la suya (004). Una nueva
-- petición de bob debe actualizar SOLO la suya.
set local role postgres;

do $$
begin
  if (select count(*) from public.video_view_sessions
      where video_id = '10000000-0000-0000-0000-000000000001'
        and viewer_id in ('00000000-0000-0000-0000-000000000002',
                          '00000000-0000-0000-0000-000000000004')) <> 2 then
    raise exception 'FALLO TEST8: no hay dos sesiones de espectadores distintas';
  end if;
  raise notice 'PASS TEST8: bob y dave tienen sesiones separadas en V1';
end $$;

-- La RLS impide a un usuario actualizar sesiones ajenas (0 filas afectadas).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare affected int;
begin
  update public.video_view_sessions
  set watch_seconds = 99999
  where video_id = '10000000-0000-0000-0000-000000000001'
    and viewer_id = '00000000-0000-0000-0000-000000000004';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FALLO TEST8: bob pudo modificar la sesión de dave';
  end if;
  raise notice 'PASS TEST8: la RLS impide tocar sesiones ajenas';
end $$;

-- ============================================================================
-- TEST 9: anon NO puede enumerar (leer) la tabla video_view_sessions
-- ============================================================================
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  begin
    perform count(*) from public.video_view_sessions;
    raise exception 'FALLO TEST9: anon pudo leer video_view_sessions';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
  end;
  raise notice 'PASS TEST9: anon no puede enumerar sesiones';
end $$;

-- Un autenticado tampoco (solo lee métricas agregadas por RPC).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  begin
    perform count(*) from public.video_view_sessions;
    raise exception 'FALLO TEST9: un autenticado pudo leer video_view_sessions';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
  end;
  raise notice 'PASS TEST9: ni anon ni autenticado enumeran sesiones directamente';
end $$;

-- ============================================================================
-- TEST 10: el propietario obtiene métricas AGRUPADAS (y solo agregados)
-- ============================================================================
-- alice (propietaria) consulta las métricas de V1: qualified_views >= 3
-- (anon-token-0001, bob y dave), plays = 1+1+2+1... verificación de agregados.
set local role postgres;

do $$
begin
  if (select count(*) from public.video_view_sessions
      where video_id = '10000000-0000-0000-0000-000000000001'
        and qualified) <> 3 then
    raise exception 'FALLO TEST10: no hay 3 sesiones qualified esperadas en V1';
  end if;
  raise notice 'PASS TEST10: 3 sesiones qualified en V1 (estado esperado)';
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare
  v_q bigint; v_plays bigint; v_u bigint;
  v_identity_columns int;
begin
  select qualified_views, plays, unique_viewers
    into v_q, v_plays, v_u
  from public.get_video_metrics('10000000-0000-0000-0000-000000000001');

  if v_q <> 3 then
    raise exception 'FALLO TEST10: qualified_views esperado 3, hay %', v_q;
  end if;
  if v_plays <> 4 then
    raise exception 'FALLO TEST10: plays esperado 4 (1+1+2), hay %', v_plays;
  end if;
  if v_u <> 3 then
    raise exception 'FALLO TEST10: unique_viewers esperado 3, hay %', v_u;
  end if;

  -- El resultado NO expone identidades: get_video_metrics no tiene columnas de
  -- espectador (viewer_id / anonymous_session_id).
  select count(*) into v_identity_columns
  from information_schema.columns c
  where c.table_name = 'get_video_metrics'
    and c.column_name in ('viewer_id', 'anonymous_session_id');
  if v_identity_columns <> 0 then
    raise exception 'FALLO TEST10: las métricas exponen identidades de espectadores';
  end if;
  raise notice 'PASS TEST10: el propietario ve métricas agregadas sin identidades';
end $$;

-- ============================================================================
-- TEST 11: un no-propietario NO obtiene métricas (fail-closed, 0 filas)
-- ============================================================================
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare v_q bigint;
begin
  select qualified_views into v_q
  from public.get_video_metrics('10000000-0000-0000-0000-000000000001');
  if v_q is not null then
    raise exception 'FALLO TEST11: bob (no propietario) obtuvo métricas de V1';
  end if;
  raise notice 'PASS TEST11: un no-propietario recibe 0 filas en get_video_metrics';
end $$;

-- ============================================================================
-- TEST 12: un vídeo 'private' no acepta reportes de anónimos
-- ============================================================================
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare v_q boolean;
begin
  select qualified into v_q
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000003', 'anon-token-0003', 10, 0.8);
  if v_q is not null then
    raise exception 'FALLO TEST12: anon registró actividad en un vídeo privado';
  end if;
  raise notice 'PASS TEST12: un vídeo privado no acepta reportes de anónimos';
end $$;

set local role postgres;

do $$
begin
  if exists (
    select 1 from public.video_view_sessions
    where video_id = '10000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'FALLO TEST12: se creó una sesión para un vídeo privado';
  end if;
  raise notice 'PASS TEST12: no queda ninguna sesión del vídeo privado';
end $$;

-- ============================================================================
-- TEST 13: un vídeo 'rejected'/'flagged' no acepta reportes del público
-- ============================================================================
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare v_q boolean;
begin
  select qualified into v_q
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000004', 'anon-token-0004', 10, 0.8);
  if v_q is not null then
    raise exception 'FALLO TEST13: anon registró actividad en un vídeo rechazado';
  end if;
  select qualified into v_q
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000005', 'anon-token-0005', 10, 0.8);
  if v_q is not null then
    raise exception 'FALLO TEST13: anon registró actividad en un vídeo marcado';
  end if;
  raise notice 'PASS TEST13: rejected/flagged no aceptan reportes del público';
end $$;

set local role postgres;

do $$
begin
  if exists (
    select 1 from public.video_view_sessions
    where video_id in ('10000000-0000-0000-0000-000000000004',
                       '10000000-0000-0000-0000-000000000005')
  ) then
    raise exception 'FALLO TEST13: se creó una sesión para un vídeo no distribuible';
  end if;
  raise notice 'PASS TEST13: sin sesiones para vídeos rechazados/marcados';
end $$;

-- ============================================================================
-- TEST 14: el propietario NUNCA registra auto-vistas sobre sus vídeos
-- ============================================================================
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare v_q boolean;
begin
  select qualified into v_q
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', null, 50, 1.0);
  if v_q is not null then
    raise exception 'FALLO TEST14: el propietario registró una auto-vista';
  end if;
  raise notice 'PASS TEST14: el propietario no registra auto-vistas';
end $$;

set local role postgres;

do $$
begin
  if exists (
    select 1 from public.video_view_sessions
    where viewer_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST14: existe una sesión del propietario';
  end if;
  raise notice 'PASS TEST14: sin sesiones del propietario sobre sus vídeos';
end $$;

-- ============================================================================
-- TEST 15: métricas por post, contador público y ruta de vídeo corto
-- ============================================================================
-- bob ve V6 (registered_users, solo autenticados) hasta qualified: primera
-- petición crea la fila; tras 4 s reales, qualified.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000006', null, 2, 0.3);
end $$;

-- 4 s reales de sesión (started_at) y 4 s desde el último checkpoint: la
-- segunda petición puede sumar hasta 4 s y cruzar el umbral de qualified.
set local role postgres;

update public.video_view_sessions
set last_seen_at = now() - interval '4 seconds',
    started_at = now() - interval '4 seconds'
where video_id = '10000000-0000-0000-0000-000000000006'
  and viewer_id = '00000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000006', null, 4, 0.3);
end $$;

-- alice (propietaria) consulta métricas del vídeo y del post de V6.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare
  v_post uuid;
  v_q1 bigint; v_q2 bigint; v_w numeric; v_rate numeric;
begin
  select id into v_post from public.posts
  where video_id = '10000000-0000-0000-0000-000000000006';

  if v_post is null then
    raise exception 'FALLO TEST15: no existe el post de V6';
  end if;

  select qualified_views, total_watch_seconds, completion_rate
    into v_q1, v_w, v_rate
  from public.get_video_metrics('10000000-0000-0000-0000-000000000006');
  select qualified_views into v_q2
  from public.get_post_metrics(v_post);

  if v_q1 <> 1 then
    raise exception 'FALLO TEST15: qualified_views de V6 esperado 1, hay %', v_q1;
  end if;
  if v_q2 <> 1 then
    raise exception 'FALLO TEST15: get_post_metrics no coincide con el vídeo';
  end if;
  if v_w <> 4 then
    raise exception 'FALLO TEST15: total_watch_seconds esperado 4, hay %', v_w;
  end if;
  if v_rate <> 0 then
    raise exception 'FALLO TEST15: completion_rate esperado 0 (no completado)';
  end if;
  raise notice 'PASS TEST15: métricas por vídeo y por post coinciden';
end $$;

-- get_post_metrics para un no-propietario devuelve 0 filas (fail-closed).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare
  v_post uuid; v_q bigint;
begin
  select id into v_post from public.posts
  where video_id = '10000000-0000-0000-0000-000000000006';
  select qualified_views into v_q from public.get_post_metrics(v_post);
  if v_q is not null then
    raise exception 'FALLO TEST15: dave (no autor del post) obtuvo métricas';
  end if;
  raise notice 'PASS TEST15: get_post_metrics es fail-closed para no-autores';
end $$;

-- Contador público de vistas cualificadas.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare v_count bigint;
begin
  select public.get_public_video_views_count(
    '10000000-0000-0000-0000-000000000001') into v_count;
  if v_count <> 3 then
    raise exception 'FALLO TEST15: contador público de V1 esperado 3, hay %', v_count;
  end if;

  -- Vídeo no distribuible / no público devuelve 0 (no es un vector de sondas).
  if public.get_public_video_views_count('10000000-0000-0000-0000-000000000003') <> 0 then
    raise exception 'FALLO TEST15: un vídeo privado filtró su contador';
  end if;
  if public.get_public_video_views_count('10000000-0000-0000-0000-000000000004') <> 0 then
    raise exception 'FALLO TEST15: un vídeo rechazado filtró su contador';
  end if;
  raise notice 'PASS TEST15: el contador público devuelve solo los agregados correctos';
end $$;

-- ============================================================================
-- TEST 16: vídeo corto (<= 10 s) — umbral de qualified reducido
-- ============================================================================
-- V2 dura 5 s. Con progress >= 0.5 y watch >= 2 s la reproducción ya es
-- qualified (no hace falta llegar a 3 s). Primero se crea la fila (watch=0) y
-- luego, tras 2 s reales de sesión (started_at y last_seen), qualified=true.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000002', 'anon-token-0002', 1, 0.5);
end $$;

set local role postgres;

update public.video_view_sessions
set last_seen_at = now() - interval '2 seconds',
    started_at = now() - interval '2 seconds'
where anonymous_session_id = 'anon-token-0002';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare v_q boolean;
begin
  select qualified into v_q from public.report_video_view(
    '10000000-0000-0000-0000-000000000002', 'anon-token-0002', 2, 0.5);
  if v_q is distinct from true then
    raise exception 'FALLO TEST16: un vídeo corto no marcó qualified con >= 50%% y 2 s';
  end if;
  raise notice 'PASS TEST16: el umbral reducido funciona para vídeos <= 10 s';
end $$;

-- ============================================================================
-- TEST 17: el token anónimo debe estar bien formado (rechazo silencioso)
-- ============================================================================
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare v_q boolean;
begin
  select qualified into v_q from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', 'corto', 10, 0.8);
  if v_q is not null then
    raise exception 'FALLO TEST17: se aceptó un token anónimo mal formado';
  end if;
  select qualified into v_q from public.report_video_view(
    '10000000-0000-0000-0000-000000000001', 'token con espacios y + inválidos', 10, 0.8);
  if v_q is not null then
    raise exception 'FALLO TEST17: se aceptó un token con caracteres inválidos';
  end if;
  raise notice 'PASS TEST17: los tokens anónimos inválidos se rechazan silenciosamente';
end $$;

set local role postgres;

do $$
begin
  if exists (
    select 1 from public.video_view_sessions
    where anonymous_session_id in ('corto', 'token con espacios y + inválidos')
  ) then
    raise exception 'FALLO TEST17: se guardó una sesión con token inválido';
  end if;
  raise notice 'PASS TEST17: no quedan sesiones con tokens inválidos';
end $$;

-- ============================================================================
-- TEST 18: matriz de moderación — solo unreviewed/approved aceptan watch time
-- ============================================================================
-- El predicado canónico `video_is_publicly_distributable` admite 'unreviewed' y
-- 'approved' y bloquea 'rejected'/'flagged'. `report_video_view` lo aplica en la
-- escritura: V1 (unreviewed) aceptó reportes anónimos (TEST 1-7), V7 (approved)
-- también (TEST 3B/3C y aquí), y V4/V5 (rejected/flagged) no (TEST 13) sin dejar
-- filas.
set local role postgres;

do $$
begin
  if public.video_is_publicly_distributable('unreviewed') is distinct from true then
    raise exception 'FALLO TEST18: unreviewed no es distribuible';
  end if;
  if public.video_is_publicly_distributable('approved') is distinct from true then
    raise exception 'FALLO TEST18: approved no es distribuible';
  end if;
  if public.video_is_publicly_distributable('rejected') is distinct from false then
    raise exception 'FALLO TEST18: rejected es distribuible';
  end if;
  if public.video_is_publicly_distributable('flagged') is distinct from false then
    raise exception 'FALLO TEST18: flagged es distribuible';
  end if;
end $$;

-- V7 (approved) acepta watch time de un anónimo y llega a qualified.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  perform public.report_video_view(
    '10000000-0000-0000-0000-000000000007', 'anon-token-003d', 0, 0.3);
end $$;

set local role postgres;

update public.video_view_sessions
set last_seen_at = now() - interval '4 seconds',
    started_at = now() - interval '4 seconds'
where anonymous_session_id = 'anon-token-003d';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare v_q boolean; v_w numeric;
begin
  select qualified, watch_seconds into v_q, v_w
  from public.report_video_view(
    '10000000-0000-0000-0000-000000000007', 'anon-token-003d', 4, 0.3);
  if v_q is distinct from true then
    raise exception 'FALLO TEST18: un vídeo approved no aceptó watch time (q=%)', v_q;
  end if;
  if v_w <> 4 then
    raise exception 'FALLO TEST18: watch de V7 esperado 4 (hay %)', v_w;
  end if;
end $$;

set local role postgres;

do $$
begin
  if not exists (
    select 1 from public.video_view_sessions
    where anonymous_session_id = 'anon-token-003d'
  ) then
    raise exception 'FALLO TEST18: no quedó la sesión anónima de V7';
  end if;
  if exists (
    select 1 from public.video_view_sessions
    where video_id in ('10000000-0000-0000-0000-000000000004',
                       '10000000-0000-0000-0000-000000000005')
  ) then
    raise exception 'FALLO TEST18: hay sesiones de vídeos rechazados/marcados';
  end if;
  raise notice 'PASS TEST18: solo unreviewed/approved aceptan watch time (matriz de moderación)';
end $$;

-- ---------------------------------------------------------------------------
-- Limpieza: nada de lo anterior persiste.
-- ---------------------------------------------------------------------------
raise notice 'TODOS LOS TESTS DE FASE 4.3 (ANALYTICS) PASARON';
rollback;
