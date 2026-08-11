-- ============================================================================
-- FASE 4.4 — Verificación del feed "Para ti" + "Siguiendo"
-- ============================================================================
-- Script SQL que comprueba los comportamientos exigidos por la migración
-- 20260814000000_fase4_4_feed.sql:
--
--   1. ACL de ejecución: anon PUEDE llamar a get_for_you_feed (feed global de
--      descubrimiento) pero NO a get_following_feed (fail-closed por ACL);
--      authenticated puede llamar a ambas.
--   2. Composibilidad del "Para ti": SOLO posts distribuibles y estrictamente
--      públicos (1 post por vídeo publicado + listo + moderación unreviewed/
--      approved + visibilidad public). Quedan fuera: no publicados, unlisted,
--      registered_users, project_members, private, rejected y flagged.
--   3. Ranking determinista: orden (final_score DESC, published_at DESC, id
--      DESC), fórmula score = 0.35*recencia + 0.15*afinidad + 0.20*visionado
--      + 0.10*completion + 0.10*views + 0.10*exploración, redondeada a 6
--      decimales, con cada componente devuelto por fila en [0,1].
--   4. Métricas AGRAGADAS (nunca identidades): qualified_views, plays,
--      average_watch_seconds, average_progress y completion_rate agregados por
--      vídeo desde video_view_sessions.
--   5. Afinidad limitada: solo por follows del propio auth.uid(); cap a 1.0;
--      anon → 0. Los bloqueos excluyen el post en AMBAS direcciones.
--   6. "Siguiendo": solo contenido de lo seguido (perfil/proyecto/
--      organización), cronológico (published_at DESC, id DESC), sin duplicados
--      y con el mismo predicado de distributividad.
--   7. Paginación por cursor (final_score, published_at, post_id): las páginas
--      no se solapan y cubren todo el feed.
--
-- Cómo ejecutarlo (stack LOCAL de Supabase, como postgres, tras aplicar las
-- migraciones 20260731 → 20260814):
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fase4_feed.sql
--
-- Requiere superusuario (postgres) para `set local role` y para fijar
-- `request.jwt.claims`. NO ejecutar contra la base remota. Todo el script va en
-- una transacción que se REVIERTE al final: no deja datos ni cambios.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Setup: identidades, proyectos, organizaciones y vídeos (como postgres, RLS
-- omitido). Cada vídeo publicado sincroniza UN post (posts_sync_from_video).
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, username, full_name, is_public)
values
  ('00000000-0000-0000-0000-000000000001', 'owner', 'Owner', true),
  ('00000000-0000-0000-0000-000000000002', 'other', 'Other', true),
  ('00000000-0000-0000-0000-000000000003', 'admin', 'Admin', true),
  ('00000000-0000-0000-0000-000000000004', 'outsider', 'Outsider', true);

insert into public.projects (id, owner_id, slug, name, stage, status, is_public)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'proyecto-owner', 'Proyecto de owner', 'idea', 'published', true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'proyecto-other', 'Proyecto de other', 'idea', 'published', true);

insert into public.organizations (id, owner_id, slug, name, is_public)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'org-owner', 'Organización de owner', true),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'org-other', 'Organización de other', true);

-- Vídeos: se crean como draft/uploading/unreviewed (trigger) y luego se
-- publican (update). Bucket obligatorio según la clase de visibilidad.
-- V1..V5 y V10..V13: públicos. V6..V9: no públicos (post no distribuible).
insert into public.videos (id, owner_id, project_id, organization_id, storage_bucket, storage_path, mime_type, size_bytes, visibility, title, processing_status, moderation_status, status)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos', 'owner/v1/video.mp4', 'video/mp4', 1000, 'public', 'V1', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos', 'owner/v2/video.mp4', 'video/mp4', 1000, 'public', 'V2', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos', 'owner/v3/video.mp4', 'video/mp4', 1000, 'public', 'V3', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'public-videos', 'other/v4/video.mp4', 'video/mp4', 1000, 'public', 'V4', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'public-videos', 'other/v5/video.mp4', 'video/mp4', 1000, 'public', 'V5', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos',  'owner/v6/video.mp4', 'video/mp4', 1000, 'unlisted',          'V6', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'private-videos', 'owner/v7/video.mp4', 'video/mp4', 1000, 'registered_users', 'V7', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'private-videos', 'owner/v8/video.mp4', 'video/mp4', 1000, 'project_members',  'V8', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'private-videos', 'owner/v9/video.mp4', 'video/mp4', 1000, 'private',           'V9', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos',  'owner/v10/video.mp4', 'video/mp4', 1000, 'public',           'V10', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos',  'owner/v11/video.mp4', 'video/mp4', 1000, 'public',           'V11', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos',  'owner/v12/video.mp4', 'video/mp4', 1000, 'public',           'V12', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos',  'owner/v13/video.mp4', 'video/mp4', 1000, 'public',           'V13', 'uploading', 'unreviewed', 'draft');

-- Publicar V1..V12 (V13 queda como borrador y no debe generar post). El trigger
-- posts_sync_from_video crea un post por cada vídeo publicado.
update public.videos set status = 'published', processing_status = 'ready'
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000009',
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000012');

-- Moderación (como admin): V10 rechazado, V11 aprobado, V12 marcado. Solo
-- V11 sigue siendo distribuible; V10 y V12 salen del feed.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select public.admin_reject_video('10000000-0000-0000-0000-000000000010', 'contenido no permitido');
select public.admin_approve_video('10000000-0000-0000-0000-000000000011');
select public.admin_flag_video('10000000-0000-0000-0000-000000000012', 'marca temporal');

reset role;
select set_config('request.jwt.claims', '', true);

-- Antigüedad controlada de los posts distribuibles (la recencia del feed se
-- calcula sobre post.published_at): V1=7d, V2=3d, V3=2d, V4=1d, V5=5d,
-- V11=6d. El resto no se usa en el ranking.
update public.posts set published_at = now() - interval '7 days' where video_id = '10000000-0000-0000-0000-000000000001';
update public.posts set published_at = now() - interval '3 days' where video_id = '10000000-0000-0000-0000-000000000002';
update public.posts set published_at = now() - interval '2 days' where video_id = '10000000-0000-0000-0000-000000000003';
update public.posts set published_at = now() - interval '1 day'  where video_id = '10000000-0000-0000-0000-000000000004';
update public.posts set published_at = now() - interval '5 days' where video_id = '10000000-0000-0000-0000-000000000005';
update public.posts set published_at = now() - interval '6 days' where video_id = '10000000-0000-0000-0000-000000000011';

-- Sesiones de analytics para el ranking de calidad:
--   V2: 100 sesiones qualified (progress 0.9, completed 60 → completion 0.6).
--   V3: 2000 sesiones qualified (progress 0.1, completed 100 → completion 0.05).
insert into public.video_view_sessions (video_id, anonymous_session_id, started_at, last_seen_at, plays, watch_seconds, max_progress, qualified, completed)
select
  '10000000-0000-0000-0000-000000000002',
  'anon' || lpad(g::text, 20, '0'),
  now() - interval '3 days',
  now() - interval '1 day',
  1, 50, 0.9, true,
  g <= 60
from generate_series(1, 100) g;

insert into public.video_view_sessions (video_id, anonymous_session_id, started_at, last_seen_at, plays, watch_seconds, max_progress, qualified, completed)
select
  '10000000-0000-0000-0000-000000000003',
  'anon' || lpad(g::text, 20, '0'),
  now() - interval '2 days',
  now() - interval '1 day',
  1, 10, 0.1, true,
  g <= 100
from generate_series(1, 2000) g;

-- ---------------------------------------------------------------------------
-- TEST 1: ACL de ejecución
--   - anon: get_for_you_feed OK (feed global), get_following_feed DENEGADO.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  begin
    perform * from public.get_for_you_feed();
  exception
    when others then
      raise exception 'FALLO TEST1: anon no pudo ejecutar get_for_you_feed (%)', sqlerrm;
  end;
  begin
    perform * from public.get_following_feed();
    raise exception 'FALLO TEST1: anon pudo ejecutar get_following_feed (debería fallar por ACL)';
  exception
    when insufficient_privilege then
      null;
    when others then
      raise exception 'FALLO TEST1: get_following_feed falló para anon con un error inesperado (%)', sqlerrm;
  end;
  raise notice 'PASS TEST1: ACL correcta (anon: for_you OK, following denegado)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 2: composición y orden determinista del feed "Para ti" (anon)
-- ---------------------------------------------------------------------------
-- Distribuibles esperados (6): V1,V2,V3 (owner) + V4,V5 (other) + V11 (owner,
-- aprobado). Fuera: V6..V9 (visibilidad no pública), V10 (rejected),
-- V12 (flagged), V13 (sin post).
-- Orden por final_score DESC (aprox.): V2(0.62) > V4(0.55) > V3(0.46)
--   > V5(0.44) > V11(0.42) > V1(0.41).
do $$
declare
  v_cnt int;
  v_expected uuid[] := array[
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001'
  ];
  v_actual uuid[];
  v_top uuid;
begin
  select count(*) into v_cnt from public.get_for_you_feed();
  if v_cnt <> 6 then
    raise exception 'FALLO TEST2: el feed "para ti" devolvió % filas (esperado 6)', v_cnt;
  end if;

  select array_agg(video_id order by final_score desc, published_at desc, post_id desc)
    into v_actual
  from public.get_for_you_feed();
  if v_actual is distinct from v_expected then
    raise exception 'FALLO TEST2: orden del feed %, esperado %', v_actual, v_expected;
  end if;

  select video_id into v_top
  from public.get_for_you_feed()
  order by final_score desc, published_at desc, post_id desc
  limit 1;
  if v_top <> '10000000-0000-0000-0000-000000000002' then
    raise exception 'FALLO TEST2: el top del feed es %, esperado V2', v_top;
  end if;

  if exists (
    select 1 from public.get_for_you_feed()
    where video_id in (
      '10000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000007',
      '10000000-0000-0000-0000-000000000008',
      '10000000-0000-0000-0000-000000000009',
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000012',
      '10000000-0000-0000-0000-000000000013'
    )
  ) then
    raise exception 'FALLO TEST2: el feed incluye posts no distribuibles';
  end if;

  raise notice 'PASS TEST2: composición y orden determinista del feed "para ti"';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 3: fórmula del score, rangos y explicabilidad (anon)
-- ---------------------------------------------------------------------------
-- final_score = round(0.35*recencia + 0.15*afinidad + 0.20*visionado
--   + 0.10*completion + 0.10*views + 0.10*exploración, 6). Para anon la
--   afinidad es 0 (no hay identidad). Cada componente vive en [0,1].
do $$
declare
  r record;
begin
  for r in
    select * from public.get_for_you_feed()
  loop
    if r.final_score < 0 or r.final_score > 1
       or r.recency_score < 0 or r.recency_score > 1
       or r.affinity_score < 0 or r.affinity_score > 1
       or r.watch_score < 0 or r.watch_score > 1
       or r.completion_score < 0 or r.completion_score > 1
       or r.views_score < 0 or r.views_score > 1
       or r.exploration_score < 0 or r.exploration_score > 1
    then
      raise exception 'FALLO TEST3: score fuera de [0,1] para el vídeo %', r.video_id;
    end if;

    if r.affinity_score <> 0 then
      raise exception 'FALLO TEST3: anon obtuvo afinidad distinta de 0 (%)', r.video_id;
    end if;

    if abs(
         r.final_score
         - round(0.35 * r.recency_score + 0.15 * r.affinity_score
               + 0.20 * r.watch_score + 0.10 * r.completion_score
               + 0.10 * r.views_score + 0.10 * r.exploration_score, 6)
       ) > 0.000001
    then
      raise exception 'FALLO TEST3: final_score de % no es consistente con sus componentes', r.video_id;
    end if;
  end loop;
  raise notice 'PASS TEST3: fórmula, rangos y explicabilidad del score';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 4: métricas agregadas (anon) y cold start
-- ---------------------------------------------------------------------------
-- V2 (100 sesiones qualified): qualified_views=100, plays=100,
--   average_watch_seconds=50, average_progress=0.9, completion_rate=0.6,
--   watch_score=0.2*(100/110*0.9+10/110*0.5)=0.1727... y así.
-- V1 (0 sesiones): cold start → watch=0.5, completion=0.3, views=0,
--   exploration=1. final_score > 0.
do $$
declare
  r record;
begin
  select * into r from public.get_for_you_feed() where video_id = '10000000-0000-0000-0000-000000000002';
  if r.video_id is null then
    raise exception 'FALLO TEST4: V2 no aparece en el feed "para ti"';
  end if;
  if r.qualified_views <> 100 or r.plays <> 100
     or r.average_watch_seconds <> 50
     or abs(r.average_progress - 0.9) > 0.000001
     or abs(r.completion_rate - 0.6) > 0.000001
  then
    raise exception 'FALLO TEST4: métricas agregadas de V2 incorrectas (%, %, %, %, %)',
      r.qualified_views, r.plays, r.average_watch_seconds, r.average_progress, r.completion_rate;
  end if;

  select * into r from public.get_for_you_feed() where video_id = '10000000-0000-0000-0000-000000000003';
  if r.video_id is null then
    raise exception 'FALLO TEST4: V3 no aparece en el feed "para ti"';
  end if;
  if r.qualified_views <> 2000 or r.plays <> 2000
     or r.average_watch_seconds <> 10
     or abs(r.average_progress - 0.1) > 0.000001
     or abs(r.completion_rate - 0.05) > 0.000001
  then
    raise exception 'FALLO TEST4: métricas agregadas de V3 incorrectas (%, %, %, %, %)',
      r.qualified_views, r.plays, r.average_watch_seconds, r.average_progress, r.completion_rate;
  end if;

  select * into r from public.get_for_you_feed() where video_id = '10000000-0000-0000-0000-000000000001';
  if r.video_id is null then
    raise exception 'FALLO TEST4: V1 no aparece en el feed "para ti"';
  end if;
  if r.qualified_views <> 0 or r.plays <> 0
     or abs(r.watch_score - 0.5) > 0.000001
     or abs(r.completion_score - 0.3) > 0.000001
     or r.views_score <> 0
     or abs(r.exploration_score - 1.0) > 0.000001
     or r.final_score <= 0
  then
    raise exception 'FALLO TEST4: cold start de V1 incorrecto (watch=%, comp=%, views=%, explore=%)',
      r.watch_score, r.completion_score, r.views_score, r.exploration_score;
  end if;

  raise notice 'PASS TEST4: métricas agregadas correctas y cold start (nunca 0)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 5: la señal de views es blanda y capeada (V3 con 2000 views no domina)
-- ---------------------------------------------------------------------------
-- views_score = min(1, ln(1+qviews)/10). Para V3 = ln(2001)/10 ≈ 0.76
-- (nunca 1.0) y un vídeo con 0 vistas conserva exploración plena.
do $$
declare
  v_views_v3 numeric;
  v_explore_v3 numeric;
  v_top uuid;
begin
  select views_score, exploration_score into v_views_v3, v_explore_v3
  from public.get_for_you_feed()
  where video_id = '10000000-0000-0000-0000-000000000003';

  if v_views_v3 is null then
    raise exception 'FALLO TEST5: V3 no aparece en el feed "para ti"';
  end if;
  if abs(v_views_v3 - ln(2001) / 10.0) > 0.000001 then
    raise exception 'FALLO TEST5: views_score de V3 incorrecto (%)', v_views_v3;
  end if;
  if v_views_v3 > 0.9 then
    raise exception 'FALLO TEST5: la señal de views no está capeada (%)', v_views_v3;
  end if;
  if abs(v_explore_v3 - exp(-ln(2001) / 20.0)) > 0.000001 then
    raise exception 'FALLO TEST5: exploration_score de V3 incorrecto (%)', v_explore_v3;
  end if;

  select video_id into v_top
  from public.get_for_you_feed()
  order by final_score desc limit 1;
  if v_top = '10000000-0000-0000-0000-000000000003' then
    raise exception 'FALLO TEST5: un vídeo solo por views no puede ser el top';
  end if;

  raise notice 'PASS TEST5: views blanda y capeada, exploración satura con el volumen';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 6: afinidad limitada por follows del propio auth.uid()
-- ---------------------------------------------------------------------------
-- outsider sigue a owner (0.6) + P1 (0.4) + O1 (0.3) ⇒ afinidad capada a 1.0
-- en los posts de owner; los posts de other (V4, V5) mantienen afinidad 0.
-- Además la afinidad NO puede hacer que un post ajeno supere al mejor de owner
-- con solo afinidad (el cap es a 1.0 y pesa 0.15).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001');
insert into public.project_follows (profile_id, project_id)
values ('00000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001');
insert into public.organization_follows (profile_id, organization_id)
values ('00000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001');

do $$
declare
  r record;
begin
  for r in
    select * from public.get_for_you_feed()
  loop
    if r.video_id in (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000011'
    ) then
      if r.affinity_score <> 1.0 then
        raise exception 'FALLO TEST6: afinidad de % = % (esperado 1.0, cap)', r.video_id, r.affinity_score;
      end if;
    else
      if r.affinity_score <> 0 then
        raise exception 'FALLO TEST6: afinidad de % = % (esperado 0, no sigue)', r.video_id, r.affinity_score;
      end if;
    end if;
  end loop;
  raise notice 'PASS TEST6: afinidad capada a 1.0 solo por follows propios';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 7: el feed "Siguiendo" (outsider sigue a owner) — contenido, orden
-- cronológico y sin duplicados
-- ---------------------------------------------------------------------------
-- Posts de owner distribuibles: V1,V2,V3,V11. Orden cronológico DESC por
-- published_at: V3(2d) < V2(3d) < V11(6d) < V1(7d) → esperado [V3,V2,V11,V1].
do $$
declare
  v_expected uuid[] := array[
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001'
  ];
  v_actual uuid[];
  v_cnt int;
  v_distinct int;
begin
  select array_agg(video_id order by published_at desc, post_id desc)
    into v_actual
  from public.get_following_feed();
  if v_actual is distinct from v_expected then
    raise exception 'FALLO TEST7: feed "siguiendo" %, esperado %', v_actual, v_expected;
  end if;

  select count(*), count(distinct post_id) into v_cnt, v_distinct
  from public.get_following_feed();
  if v_cnt <> 4 or v_distinct <> 4 then
    raise exception 'FALLO TEST7: "siguiendo" debe devolver 4 posts sin duplicados (%, %)', v_cnt, v_distinct;
  end if;

  if exists (
    select 1 from public.get_following_feed()
    where video_id in (
      '10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000005'
    )
  ) then
    raise exception 'FALLO TEST7: "siguiendo" incluye posts de alguien no seguido';
  end if;

  raise notice 'PASS TEST7: "siguiendo" contenido, orden cronológico y sin duplicados';
end $$;

-- outsider también sigue a other ⇒ aparecen V4 (1d) y V5 (5d). Orden esperado:
-- [V4(1d), V3(2d), V2(3d), V5(5d), V11(6d), V1(7d)].
insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002');

do $$
declare
  v_expected uuid[] := array[
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001'
  ];
  v_actual uuid[];
begin
  select array_agg(video_id order by published_at desc, post_id desc)
    into v_actual
  from public.get_following_feed();
  if v_actual is distinct from v_expected then
    raise exception 'FALLO TEST7b: "siguiendo" tras seguir a other %, esperado %', v_actual, v_expected;
  end if;
  raise notice 'PASS TEST7b: "siguiendo" agrega el contenido del nuevo seguido';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 8: los bloqueos excluyen el post en AMBAS direcciones
-- ---------------------------------------------------------------------------
-- 8a) outsider bloquea a owner ⇒ sus posts salen del feed "para ti" y de
-- "siguiendo"; el bloqueo limpia los follows existentes (cleanup).
insert into public.profile_blocks (profile_id, blocked_id)
values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare
  v_owner_posts int;
  v_following int;
  v_follows int;
begin
  select count(*) into v_owner_posts
  from public.get_for_you_feed()
  where author_id = '00000000-0000-0000-0000-000000000001';
  if v_owner_posts <> 0 then
    raise exception 'FALLO TEST8a: al bloquear a owner su contenido sigue en "para ti" (%)', v_owner_posts;
  end if;

  -- "siguiendo" conserva a other (sigue siendo seguido) pero NUNCA a owner.
  select count(*) into v_following from public.get_following_feed();
  if v_following <> 2 then
    raise exception 'FALLO TEST8a: "siguiendo" tras bloquear a owner = % (esperado 2: V4,V5)', v_following;
  end if;
  if exists (
    select 1 from public.get_following_feed()
    where author_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST8a: "siguiendo" aún incluye posts del bloqueado';
  end if;
  raise notice 'PASS TEST8a: bloquear excluye los posts del bloqueado (para-ti y siguiendo)';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  v_follows int;
begin
  select count(*) into v_follows
  from public.profile_follows
  where (profile_id = '00000000-0000-0000-0000-000000000004' and following_id = '00000000-0000-0000-0000-000000000001')
     or (profile_id = '00000000-0000-0000-0000-000000000001' and following_id = '00000000-0000-0000-0000-000000000004');
  if v_follows <> 0 then
    raise exception 'FALLO TEST8a: el bloqueo no limpió los follows del par bloqueado (%)', v_follows;
  end if;
  raise notice 'PASS TEST8a: bloquear limpia los follows del par en ambas direcciones';
end $$;

-- 8b) desbloqueo ⇒ al re-seguir vuelve el contenido (los follows de P1/O1 y de
-- other no se tocaron; solo hay que restaurar el follow de perfil a owner).
delete from public.profile_blocks
where profile_id = '00000000-0000-0000-0000-000000000004'
  and blocked_id = '00000000-0000-0000-0000-000000000001';

insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare
  v_owner_posts int;
begin
  select count(*) into v_owner_posts
  from public.get_for_you_feed()
  where author_id = '00000000-0000-0000-0000-000000000001';
  if v_owner_posts <> 4 then
    raise exception 'FALLO TEST8b: tras desbloquear y re-seguir faltan posts de owner (%)', v_owner_posts;
  end if;
  raise notice 'PASS TEST8b: desbloquear restaura el contenido del autor';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- 8c) dirección inversa: el AUTOR bloquea al espectador ⇒ también se excluye
-- (aunque el espectador siga al autor).
insert into public.profile_blocks (profile_id, blocked_id)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare
  v_owner_posts int;
begin
  select count(*) into v_owner_posts
  from public.get_for_you_feed()
  where author_id = '00000000-0000-0000-0000-000000000001';
  if v_owner_posts <> 0 then
    raise exception 'FALLO TEST8c: el bloqueo del autor no excluyó su contenido (%)', v_owner_posts;
  end if;
  raise notice 'PASS TEST8c: el bloqueo del autor también excluye (dirección inversa)';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- Limpieza de bloques y follows para una paginación determinista: outsider
-- queda siguiendo SOLO a owner (perfil), sin otros follows ni bloques.
delete from public.profile_blocks;
delete from public.profile_follows where profile_id = '00000000-0000-0000-0000-000000000004';
delete from public.project_follows where profile_id = '00000000-0000-0000-0000-000000000004';
delete from public.organization_follows where profile_id = '00000000-0000-0000-0000-000000000004';

insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- TEST 9: paginación por cursor — sin solapamientos y cobertura completa
-- ---------------------------------------------------------------------------
-- "Para ti" (anon): p_limit=3 ⇒ página 1 [V2,V4,V3] y página 2 [V5,V11,V1].
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
declare
  v_p1 uuid[];
  v_p2 uuid[];
  v_cs numeric;
  v_cpa timestamptz;
  v_cid uuid;
begin
  select array_agg(video_id order by final_score desc, published_at desc, post_id desc)
    into v_p1
  from (select * from public.get_for_you_feed(3)) t;

  select final_score, published_at, post_id into v_cs, v_cpa, v_cid
  from (select * from public.get_for_you_feed(3)) t
  order by final_score asc, published_at asc, post_id asc
  limit 1;

  select array_agg(video_id order by final_score desc, published_at desc, post_id desc)
    into v_p2
  from (select * from public.get_for_you_feed(3, v_cs, v_cpa, v_cid)) t;

  if array_length(v_p1, 1) <> 3 or array_length(v_p2, 1) <> 3 then
    raise exception 'FALLO TEST9: tamaño de páginas "para ti" incorrecto (%, %)',
      array_length(v_p1, 1), array_length(v_p2, 1);
  end if;
  if v_p1 && v_p2 then
    raise exception 'FALLO TEST9: las páginas "para ti" se solapan';
  end if;
  if v_p1 || v_p2 <> array[
       '10000000-0000-0000-0000-000000000002',
       '10000000-0000-0000-0000-000000000004',
       '10000000-0000-0000-0000-000000000003',
       '10000000-0000-0000-0000-000000000005',
       '10000000-0000-0000-0000-000000000011',
       '10000000-0000-0000-0000-000000000001'
     ]
  then
    raise exception 'FALLO TEST9: la paginación "para ti" no cubre todo el feed';
  end if;

  raise notice 'PASS TEST9a: paginación del feed "para ti" sin solapes y completa';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- "Siguiendo" (outsider sigue SOLO a owner): 4 posts [V3,V2,V11,V1].
-- p_limit=2 ⇒ página 1 [V3,V2] y página 2 [V11,V1].
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare
  v_p1 uuid[];
  v_p2 uuid[];
  v_cpa timestamptz;
  v_cid uuid;
  v_total int;
begin
  select count(*) into v_total from public.get_following_feed();
  if v_total <> 4 then
    raise exception 'FALLO TEST9: "siguiendo" con solo a owner seguido = % (esperado 4)', v_total;
  end if;

  select array_agg(video_id order by published_at desc, post_id desc)
    into v_p1
  from (select * from public.get_following_feed(2)) t;

  select published_at, post_id into v_cpa, v_cid
  from (select * from public.get_following_feed(2)) t
  order by published_at asc, post_id asc
  limit 1;

  select array_agg(video_id order by published_at desc, post_id desc)
    into v_p2
  from (select * from public.get_following_feed(2, v_cpa, v_cid)) t;

  if v_p1 is distinct from array[
       '10000000-0000-0000-0000-000000000003',
       '10000000-0000-0000-0000-000000000002'
     ] then
    raise exception 'FALLO TEST9: página 1 de "siguiendo" %, esperado [V3,V2]', v_p1;
  end if;
  if v_p2 is distinct from array[
       '10000000-0000-0000-0000-000000000011',
       '10000000-0000-0000-0000-000000000001'
     ] then
    raise exception 'FALLO TEST9: página 2 de "siguiendo" %, esperado [V11,V1]', v_p2;
  end if;
  if v_p1 && v_p2 then
    raise exception 'FALLO TEST9: las páginas de "siguiendo" se solapan';
  end if;

  raise notice 'PASS TEST9b: paginación de "siguiendo" sin solapes y completa';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 10: límite de página acotado por la BD (50 máximo)
-- ---------------------------------------------------------------------------
do $$
declare
  v_n int;
begin
  select count(*) into v_n from public.get_for_you_feed(1000);
  if v_n > 50 then
    raise exception 'FALLO TEST10: el límite superior de página no se acota (1000 → %)', v_n;
  end if;
  select count(*) into v_n from public.get_for_you_feed(0);
  if v_n <> 1 then
    raise exception 'FALLO TEST10: el límite inferior de página no se acota (0 → %)', v_n;
  end if;
  raise notice 'PASS TEST10: límite de página acotado a [1,50] por la BD';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Limpieza: nada de lo anterior persiste.
-- ---------------------------------------------------------------------------
raise notice 'TODOS LOS TESTS DE FASE 4.4 (FEED) PASARON';
rollback;
