-- ============================================================================
-- FASE 5 — Verificación de la búsqueda global (perfiles, proyectos,
-- organizaciones y vídeos)
-- ============================================================================
-- Script SQL que comprueba los comportamientos exigidos por la migración
-- 20260815000000_fase5_search.sql:
--
--   1. ACL de ejecución: anon y authenticated PUEDEN llamar a las cuatro RPCs
--      (búsqueda global de descubrimiento). search_normalize está concedido a
--      anon (lo usan las columnas generadas al escribir); search_recency NO
--      (fail-closed para anon).
--   2. Privacidad (espejo de RLS): perfiles solo públicos o propios y sin
--      bloqueados en ambas direcciones; proyectos solo publicados+public;
--      organizaciones solo públicas; vídeos solo distribuibles (published +
--      ready + moderación no rechazada/marcada) y según visibilidad (public,
--      registered_users para autenticados, project_members para miembros,
--      unlisted/private solo propietario).
--   3. Filtros: role y language (perfiles), stage e industry (proyectos),
--      industry (organizaciones), language (vídeos).
--   4. Ranking determinista: browse por recencia (vídeos con engagement por
--      plays), query por 0.60*similaridad + 0.25*ts_rank + 0.15*recencia,
--      sort='recent' por recencia pura. Scores en [0,1] y redondeados a 6
--      decimales. Normalización sin acentos/case en ambos lados.
--   5. Paginación por cursor (score, created_at, id): páginas sin solape que
--      cubren todo el resultado; límite acotado a [1,50] por la BD.
--
-- Cómo ejecutarlo (stack LOCAL de Supabase, como postgres, tras aplicar las
-- migraciones 20260731 → 20260815):
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fase5_search.sql
--
-- Requiere superusuario (postgres) para `set local role` y para fijar
-- `request.jwt.claims`. NO ejecutar contra la base remota. Todo el script va en
-- una transacción que se REVIERTE al final: no deja datos ni cambios.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Setup: identidades, perfiles, proyectos, organizaciones y vídeos (como
-- postgres, RLS omitido). Los vídeos se crean como draft/uploading/unreviewed
-- y luego se publican (update), igual que en fase4_feed.sql.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.local',    extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.local',    extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local',    extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rival@test.local',    extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, username, full_name, headline, bio, location, user_types, is_public, created_at)
values
  ('00000000-0000-0000-0000-000000000001', 'owner',    'Owner',    'Cofundador de startups',  'Ayudo a emprender en tecnologia', 'Madrid', array['emprendedor'], true,  now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000002', 'other',    'Other',    'Inversor en early stage', 'Busco proyectos con traccion',    'Bogota', array['inversor'],     true,  now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000003', 'admin',    'Admin',    'Mentor de equipos',       null,                              null,     array['mentor','profesional'], true, now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000004', 'outsider', 'Outsider', 'Perfil privado',          null,                              null,     array['emprendedor'], false, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000005', 'rival',    'Rival',    'Creador de contenido',    'Otro emprendedor',                'Lima',   array['emprendedor'], true,  now() - interval '1 day');

insert into public.profile_languages (profile_id, code, proficiency)
values
  ('00000000-0000-0000-0000-000000000001', 'es', 5),
  ('00000000-0000-0000-0000-000000000002', 'en', 4);

insert into public.projects (id, owner_id, organization_id, slug, name, tagline, description, stage, status, is_public, industries, created_at)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'plataforma-videojuegos', 'Plataforma de videojuegos', 'Juegos indie en la nube', 'Desarrollamos videojuegos para moviles', 'idea',       'published', true,  array['tecnologia'], now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', null,                                 'fintech-pagos',          'Fintech de pagos',         'Pagos instantaneos',      null,                                      'crecimiento','published', true,  array['finanzas'],   now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', null,                                 'proyecto-secreto',       'Proyecto secreto',         null,                        null,                                      'idea',       'published', false, array['otros'],      now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', null,                                 'proyecto-borrador',      'Proyecto borrador',        null,                        null,                                      'idea',       'draft',     true,  array['otros'],      now() - interval '1 day');

insert into public.organizations (id, owner_id, slug, name, headline, description, location, industries, is_public, created_at)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'gamelab',       'Estudio Gamelab',       'Estudio de desarrollo de videojuegos', 'Creamos juegos',        'Madrid', array['tecnologia'], true,  now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'clinica-salud', 'Clinica Salud Vital',   'Atencion medica',                      null,                    'Bogota', array['salud'],       true,  now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'org-oculta',    'Organizacion Oculta',   null,                                   null,                    null,     array['otros'],       false, now() - interval '1 day');

-- Vídeos: V1,V2,V3,V6,V7 públicos (bucket public-videos); V4,V5,V8
-- protegidos (bucket private-videos). V7 queda como borrador.
insert into public.videos (id, owner_id, project_id, organization_id, storage_bucket, storage_path, mime_type, size_bytes, visibility, title, caption, original_language, processing_status, moderation_status, status, created_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos',  'owner/v1/video.mp4', 'video/mp4', 1000, 'public',           'Tutorial de videojuegos',    'Aprende a desarrollar juegos',       'es', 'uploading', 'unreviewed', 'draft', now() - interval '3 days'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public-videos',  'owner/v2/video.mp4', 'video/mp4', 1000, 'public',           'Pitch de la fintech',        'Presentamos la ronda',               'en', 'uploading', 'unreviewed', 'draft', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', null,                                    null,                                    'public-videos',  'owner/v3/video.mp4', 'video/mp4', 1000, 'unlisted',         'Solo enlace',                null,                                      'es', 'uploading', 'unreviewed', 'draft', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', null,                                    null,                                    'private-videos', 'other/v4/video.mp4','video/mp4', 1000, 'registered_users', 'Contenido registrado',      null,                                      'es', 'uploading', 'unreviewed', 'draft', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', null,                                    null,                                    'private-videos', 'owner/v5/video.mp4', 'video/mp4', 1000, 'private',          'Video privado',              null,                                      'es', 'uploading', 'unreviewed', 'draft', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', null,                                    null,                                    'public-videos',  'owner/v6/video.mp4', 'video/mp4', 1000, 'public',           'Video marcado',              null,                                      'es', 'uploading', 'unreviewed', 'draft', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', null,                                    null,                                    'public-videos',  'owner/v7/video.mp4', 'video/mp4', 1000, 'public',           'Borrador de video',          null,                                      'es', 'uploading', 'unreviewed', 'draft', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'private-videos', 'owner/v8/video.mp4', 'video/mp4', 1000, 'project_members', 'Solo miembros',             null,                                      'es', 'uploading', 'unreviewed', 'draft', now() - interval '1 day');

-- Publicar V1..V6 y V8 (V7 queda como borrador y no debe aparecer).
update public.videos set status = 'published', processing_status = 'ready'
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000008');

-- Moderación (como admin): V2 aprobado, V6 marcado. Ambos dejan de ser
-- 'unreviewed'; V6 ya no es distribuible.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select public.admin_approve_video('10000000-0000-0000-0000-000000000002');
select public.admin_flag_video('10000000-0000-0000-0000-000000000006', 'marca temporal');

reset role;
select set_config('request.jwt.claims', '', true);

-- Sesiones de analytics: V1 con 100 plays (engagement 1.0), V2 sin sesiones.
insert into public.video_view_sessions (video_id, anonymous_session_id, started_at, last_seen_at, plays, watch_seconds, max_progress, qualified, completed)
select
  '10000000-0000-0000-0000-000000000001',
  'anon' || lpad(g::text, 20, '0'),
  now() - interval '3 days',
  now() - interval '1 day',
  1, 50, 0.5, true, true
from generate_series(1, 100) g;

-- Relaciones sociales (como los usuarios reales, bajo RLS):
--   other sigue a owner  → is_following=true para other sobre owner.
--   owner bloquea a rival → exclusión mutua en AMBAS direcciones.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.profile_blocks (profile_id, blocked_id)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005');
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 1: ACL de ejecución
--   - anon y authenticated PUEDEN llamar a las cuatro RPCs.
--   - search_normalize está concedido a anon (lo usan las columnas generadas
--     al escribir); search_recency NO (fail-closed).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  perform * from public.search_profiles();
  perform * from public.search_projects();
  perform * from public.search_organizations();
  perform * from public.search_videos();
  raise notice 'PASS TEST1a: anon puede ejecutar las cuatro RPCs de búsqueda';
exception
  when others then
    raise exception 'FALLO TEST1a: anon no pudo ejecutar una RPC de búsqueda (%)', sqlerrm;
end $$;

do $$
begin
  begin
    perform public.search_normalize('hola');
  exception
    when insufficient_privilege then
      raise exception 'FALLO TEST1b: search_normalize debería estar concedido (lo usan las columnas generadas al escribir)';
  end;
  begin
    perform public.search_recency(now());
    raise exception 'FALLO TEST1b: anon pudo ejecutar search_recency (debería fallar por ACL)';
  exception
    when insufficient_privilege then
      null;
    when others then
      raise exception 'FALLO TEST1b: search_recency falló para anon con un error inesperado (%)', sqlerrm;
  end;
  raise notice 'PASS TEST1b: search_normalize concedido, search_recency fail-closed';
end $$;

reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  perform * from public.search_profiles();
  perform * from public.search_projects();
  perform * from public.search_organizations();
  perform * from public.search_videos();
  raise notice 'PASS TEST1c: authenticated puede ejecutar las cuatro RPCs de búsqueda';
exception
  when others then
    raise exception 'FALLO TEST1c: authenticated no pudo ejecutar una RPC de búsqueda (%)', sqlerrm;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 2: perfiles — composición, filtros y ranking (anon)
--   Browse: rival(1d) > admin(3d) > other(4d) > owner(5d) por recencia.
--   Fuera: outsider (privado). Filtros por role/language. Query normalizada.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_cnt int;
  v_expected uuid[] := array[
    '00000000-0000-0000-0000-000000000005', -- rival  (1d)
    '00000000-0000-0000-0000-000000000003', -- admin  (3d)
    '00000000-0000-0000-0000-000000000002', -- other  (4d)
    '00000000-0000-0000-0000-000000000001'  -- owner  (5d)
  ];
  v_actual uuid[];
begin
  select count(*) into v_cnt from public.search_profiles();
  if v_cnt <> 4 then
    raise exception 'FALLO TEST2: browse de perfiles devolvió % filas (esperado 4)', v_cnt;
  end if;

  if exists (
    select 1 from public.search_profiles()
    where profile_id = '00000000-0000-0000-0000-000000000004'
  ) then
    raise exception 'FALLO TEST2: browse incluyó un perfil privado (outsider)';
  end if;

  select array_agg(profile_id order by search_score desc, created_at desc, profile_id desc)
    into v_actual
  from public.search_profiles();
  if v_actual is distinct from v_expected then
    raise exception 'FALLO TEST2: orden de browse de perfiles %, esperado %', v_actual, v_expected;
  end if;

  select count(*) into v_cnt from public.search_profiles(p_role => 'emprendedor');
  if v_cnt <> 2 then
    raise exception 'FALLO TEST2: filtro role=emprendedor devolvió % filas (esperado 2)', v_cnt;
  end if;

  select count(*) into v_cnt from public.search_profiles(p_role => 'inversor');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST2: filtro role=inversor devolvió % filas (esperado 1)', v_cnt;
  end if;

  select count(*) into v_cnt from public.search_profiles(p_language => 'en');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST2: filtro language=en devolvió % filas (esperado 1)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_profiles(p_language => 'es');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST2: filtro language=es devolvió % filas (esperado 1)', v_cnt;
  end if;

  select count(*) into v_cnt from public.search_profiles(p_query => 'madrid');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST2: query "madrid" devolvió % filas (esperado 1)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_profiles(p_query => 'MADRID');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST2: query "MADRID" (mayúsculas) devolvió % filas (esperado 1)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_profiles(p_query => 'inversor');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST2: query "inversor" devolvió % filas (esperado 1)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_profiles(p_query => 'noexiste');
  if v_cnt <> 0 then
    raise exception 'FALLO TEST2: query "noexiste" devolvió % filas (esperado 0)', v_cnt;
  end if;

  if exists (
    select 1 from public.search_profiles()
    where search_score < 0 or search_score > 1
  ) then
    raise exception 'FALLO TEST2: hay scores de perfil fuera de [0,1]';
  end if;

  raise notice 'PASS TEST2: perfiles (composición, filtros, ranking y normalización)';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 3: perfiles — is_following y bloqueos simétricos
--   - other sigue a owner → is_following=true solo para owner desde other.
--   - owner bloquea a rival → ambos desaparecen mutuamente.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_following boolean;
begin
  select is_following into v_following
  from public.search_profiles()
  where profile_id = '00000000-0000-0000-0000-000000000001';
  if v_following is distinct from true then
    raise exception 'FALLO TEST3: other ve is_following=% para owner (esperado true)', v_following;
  end if;

  select is_following into v_following
  from public.search_profiles()
  where profile_id = '00000000-0000-0000-0000-000000000002';
  if v_following is distinct from false then
    raise exception 'FALLO TEST3: other ve is_following=% para sí mismo (esperado false)', v_following;
  end if;
  raise notice 'PASS TEST3a: is_following calculado por fila para el llamante';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_cnt int;
begin
  select count(*) into v_cnt from public.search_profiles();
  if v_cnt <> 3 then
    raise exception 'FALLO TEST3b: owner ve % perfiles tras bloquear a rival (esperado 3)', v_cnt;
  end if;
  if exists (
    select 1 from public.search_profiles()
    where profile_id = '00000000-0000-0000-0000-000000000005'
  ) then
    raise exception 'FALLO TEST3b: owner sigue viendo a rival tras bloquearle';
  end if;
  if exists (
    select 1 from public.search_profiles(p_query => 'rival')
  ) then
    raise exception 'FALLO TEST3b: owner encuentra a rival por query tras bloquearle';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_cnt int;
begin
  if exists (
    select 1 from public.search_profiles()
    where profile_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST3c: rival sigue viendo a owner (el bloqueo debe excluir en ambas direcciones)';
  end if;
  select count(*) into v_cnt from public.search_profiles();
  if v_cnt <> 3 then
    raise exception 'FALLO TEST3c: rival ve % perfiles (esperado 3: rival, other, admin)', v_cnt;
  end if;
  raise notice 'PASS TEST3b/c: bloqueos simétricos excluyen en ambas direcciones';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 4: proyectos — solo publicados y públicos + filtros + joins (anon)
--   Browse: P2(1d) > P1(3d). Fuera: P3 (privado) y P4 (borrador).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_cnt int;
  v_expected uuid[] := array[
    '20000000-0000-0000-0000-000000000002', -- P2 (1d)
    '20000000-0000-0000-0000-000000000001'  -- P1 (3d)
  ];
  v_actual uuid[];
  v_owner_name text;
  v_org_name text;
begin
  select count(*) into v_cnt from public.search_projects();
  if v_cnt <> 2 then
    raise exception 'FALLO TEST4: browse de proyectos devolvió % filas (esperado 2)', v_cnt;
  end if;

  if exists (
    select 1 from public.search_projects()
    where project_id in (
      '20000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000004'
    )
  ) then
    raise exception 'FALLO TEST4: browse incluyó un proyecto privado o borrador';
  end if;

  select array_agg(project_id order by search_score desc, created_at desc, project_id desc)
    into v_actual
  from public.search_projects();
  if v_actual is distinct from v_expected then
    raise exception 'FALLO TEST4: orden de browse de proyectos %, esperado %', v_actual, v_expected;
  end if;

  select count(*) into v_cnt from public.search_projects(p_stage => 'idea');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST4: filtro stage=idea devolvió % filas (esperado 1)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_projects(p_stage => 'crecimiento');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST4: filtro stage=crecimiento devolvió % filas (esperado 1)', v_cnt;
  end if;

  select count(*) into v_cnt from public.search_projects(p_industry => 'tecnologia');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST4: filtro industry=tecnologia devolvió % filas (esperado 1)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_projects(p_industry => 'finanzas');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST4: filtro industry=finanzas devolvió % filas (esperado 1)', v_cnt;
  end if;

  select count(*) into v_cnt from public.search_projects(p_query => 'fintech');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST4: query "fintech" devolvió % filas (esperado 1)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_projects(p_query => 'videojuegos');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST4: query "videojuegos" devolvió % filas (esperado 1)', v_cnt;
  end if;

  select owner_full_name, organization_name
    into v_owner_name, v_org_name
  from public.search_projects()
  where project_id = '20000000-0000-0000-0000-000000000001';
  if v_owner_name is distinct from 'Owner' or v_org_name is distinct from 'Estudio Gamelab' then
    raise exception 'FALLO TEST4: joins de P1 devolvieron owner=% org=% (esperado Owner/Estudio Gamelab)', v_owner_name, v_org_name;
  end if;

  raise notice 'PASS TEST4: proyectos (composición, filtros y joins)';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 5: organizaciones — solo públicas + filtros (anon)
--   Browse: O2(1d) > O1(3d). Fuera: O3 (privada).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_cnt int;
  v_expected uuid[] := array[
    '30000000-0000-0000-0000-000000000002', -- O2 (1d)
    '30000000-0000-0000-0000-000000000001'  -- O1 (3d)
  ];
  v_actual uuid[];
begin
  select count(*) into v_cnt from public.search_organizations();
  if v_cnt <> 2 then
    raise exception 'FALLO TEST5: browse de organizaciones devolvió % filas (esperado 2)', v_cnt;
  end if;

  if exists (
    select 1 from public.search_organizations()
    where organization_id = '30000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'FALLO TEST5: browse incluyó una organización privada';
  end if;

  select array_agg(organization_id order by search_score desc, created_at desc, organization_id desc)
    into v_actual
  from public.search_organizations();
  if v_actual is distinct from v_expected then
    raise exception 'FALLO TEST5: orden de browse de organizaciones %, esperado %', v_actual, v_expected;
  end if;

  select count(*) into v_cnt from public.search_organizations(p_industry => 'salud');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST5: filtro industry=salud devolvió % filas (esperado 1)', v_cnt;
  end if;

  select count(*) into v_cnt from public.search_organizations(p_query => 'gamelab');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST5: query "gamelab" devolvió % filas (esperado 1)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_organizations(p_query => 'clinica');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST5: query "clinica" devolvió % filas (esperado 1)', v_cnt;
  end if;

  raise notice 'PASS TEST5: organizaciones (composición y filtros)';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 6: vídeos — visibilidad escalonada (anon / authenticated / owner)
--   anon: solo V1, V2 (public). other (auth): + V4 (registered_users);
--   + V8 (project_members) cuando es miembro de P1. owner: también V3
--   (unlisted propio) y V5 (private propio). Nunca V6 (flagged) ni V7 (draft).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_cnt int;
begin
  select count(*) into v_cnt from public.search_videos();
  if v_cnt <> 2 then
    raise exception 'FALLO TEST6a: anon ve % vídeos (esperado 2: V1,V2)', v_cnt;
  end if;
  if exists (
    select 1 from public.search_videos()
    where video_id in (
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000005',
      '10000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000007',
      '10000000-0000-0000-0000-000000000008'
    )
  ) then
    raise exception 'FALLO TEST6a: anon ve vídeos no públicos o no distribuibles';
  end if;

  select count(*) into v_cnt from public.search_videos(p_language => 'en');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST6a: filtro language=en devolvió % filas (esperado 1: V2)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_videos(p_language => 'es');
  if v_cnt <> 1 then
    raise exception 'FALLO TEST6a: filtro language=es devolvió % filas (esperado 1: V1)', v_cnt;
  end if;
  raise notice 'PASS TEST6a: anon solo ve vídeos public';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_cnt int;
begin
  select count(*) into v_cnt from public.search_videos();
  if v_cnt <> 3 then
    raise exception 'FALLO TEST6b: authenticated no miembro ve % vídeos (esperado 3: V1,V2,V4)', v_cnt;
  end if;
  if exists (
    select 1 from public.search_videos()
    where video_id = '10000000-0000-0000-0000-000000000008'
  ) then
    raise exception 'FALLO TEST6b: authenticated ve V8 sin ser miembro del proyecto';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- other se une al proyecto P1 en este punto (después de TEST 6b): solo desde
-- aquí debe ver V8 (project_members).
insert into public.project_members (project_id, profile_id)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_cnt int;
begin
  select count(*) into v_cnt from public.search_videos();
  if v_cnt <> 4 then
    raise exception 'FALLO TEST6c: authenticated miembro ve % vídeos (esperado 4: V1,V2,V4,V8)', v_cnt;
  end if;
  if not exists (
    select 1 from public.search_videos()
    where video_id = '10000000-0000-0000-0000-000000000008'
  ) then
    raise exception 'FALLO TEST6c: authenticated miembro de P1 no ve V8';
  end if;
  raise notice 'PASS TEST6b/c: registered_users y project_members según visibilidad';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_cnt int;
begin
  select count(*) into v_cnt from public.search_videos();
  if v_cnt <> 6 then
    raise exception 'FALLO TEST6d: owner ve % vídeos (esperado 6: V1..V5,V8)', v_cnt;
  end if;
  if not exists (
    select 1 from public.search_videos()
    where video_id in (
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000005'
    )
  ) then
    raise exception 'FALLO TEST6d: owner no ve sus vídeos unlisted/private';
  end if;
  if exists (
    select 1 from public.search_videos()
    where video_id in (
      '10000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000007'
    )
  ) then
    raise exception 'FALLO TEST6d: owner ve un vídeo flagged o borrador';
  end if;
  raise notice 'PASS TEST6d: owner ve propios unlisted/private, nunca flagged/draft';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 7: vídeos — ranking y orden (anon)
--   Browse relevance: V1 (3d + 100 plays) > V2 (2d + 0 plays): el engagement
--   compensa la antigüedad. sort=recent: V2 > V1. Query por título.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_expected uuid[] := array[
    '10000000-0000-0000-0000-000000000001', -- V1 (más plays)
    '10000000-0000-0000-0000-000000000002'  -- V2 (más reciente)
  ];
  v_actual uuid[];
  v_top uuid;
  v_cnt int;
begin
  select array_agg(video_id order by search_score desc, created_at desc, video_id desc)
    into v_actual
  from public.search_videos();
  if v_actual is distinct from v_expected then
    raise exception 'FALLO TEST7: browse de vídeos %, esperado %', v_actual, v_expected;
  end if;

  select video_id into v_top
  from public.search_videos(p_sort => 'recent')
  order by search_score desc, created_at desc, video_id desc
  limit 1;
  if v_top <> '10000000-0000-0000-0000-000000000002' then
    raise exception 'FALLO TEST7: top con sort=recent es %, esperado V2', v_top;
  end if;

  select count(*) into v_cnt
  from public.search_videos(p_query => 'tutorial')
  where video_id = '10000000-0000-0000-0000-000000000001';
  if v_cnt <> 1 then
    raise exception 'FALLO TEST7: query "tutorial" no devolvió V1';
  end if;
  select count(*) into v_cnt
  from public.search_videos(p_query => 'fintech')
  where video_id = '10000000-0000-0000-0000-000000000002';
  if v_cnt <> 1 then
    raise exception 'FALLO TEST7: query "fintech" no devolvió V2';
  end if;

  if exists (
    select 1 from public.search_videos()
    where search_score < 0 or search_score > 1
  ) then
    raise exception 'FALLO TEST7: hay scores de vídeo fuera de [0,1]';
  end if;

  raise notice 'PASS TEST7: ranking (engagement vs recencia) y orden recent';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- TEST 8: paginación por cursor y límite acotado (anon)
--   Perfiles: página de 2 → [rival, admin]; segunda → [other, owner]; sin
--   solape y cubriendo las 4 filas. Proyectos: página de 1. Límite acotado.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_page1 uuid[];
  v_page2 uuid[];
  v_all uuid[];
  v_cursor_score numeric;
  v_cursor_created_at timestamptz;
  v_cursor_id uuid;
  v_cnt int;
begin
  select array_agg(profile_id order by search_score desc, created_at desc, profile_id desc)
    into v_page1
  from public.search_profiles(p_limit => 2);
  if array_length(v_page1, 1) <> 2 then
    raise exception 'FALLO TEST8: página 1 de perfiles tiene % filas (esperado 2)', array_length(v_page1, 1);
  end if;

  select search_score, created_at, profile_id
    into v_cursor_score, v_cursor_created_at, v_cursor_id
  from public.search_profiles(p_limit => 2)
  order by search_score desc, created_at desc, profile_id desc
  limit 1 offset 1;

  select array_agg(profile_id order by search_score desc, created_at desc, profile_id desc)
    into v_page2
  from public.search_profiles(
    p_limit => 2,
    p_cursor_score => v_cursor_score,
    p_cursor_created_at => v_cursor_created_at,
    p_cursor_id => v_cursor_id
  );

  if v_page2 is null or array_length(v_page2, 1) <> 2 then
    raise exception 'FALLO TEST8: página 2 de perfiles tiene % filas (esperado 2)', coalesce(array_length(v_page2, 1), 0);
  end if;

  if (select count(*) from unnest(v_page1) p1 join unnest(v_page2) p2 on p1 = p2) <> 0 then
    raise exception 'FALLO TEST8: las páginas de perfiles se solapan';
  end if;

  select array_agg(x order by x) into v_all
  from (select unnest(v_page1) as x union select unnest(v_page2)) u;
  if array_length(v_all, 1) <> 4 then
    raise exception 'FALLO TEST8: la unión de páginas cubre % perfiles (esperado 4)', array_length(v_all, 1);
  end if;

  -- Proyectos, página de 1: [P2] → [P1].
  select array_agg(project_id order by search_score desc, created_at desc, project_id desc)
    into v_page1
  from public.search_projects(p_limit => 1);
  if v_page1 is distinct from array['20000000-0000-0000-0000-000000000002']::uuid[] then
    raise exception 'FALLO TEST8: primera página de proyectos %, esperado [P2]', v_page1;
  end if;

  select search_score, created_at, project_id
    into v_cursor_score, v_cursor_created_at, v_cursor_id
  from public.search_projects(p_limit => 1);

  select array_agg(project_id order by search_score desc, created_at desc, project_id desc)
    into v_page2
  from public.search_projects(
    p_limit => 1,
    p_cursor_score => v_cursor_score,
    p_cursor_created_at => v_cursor_created_at,
    p_cursor_id => v_cursor_id
  );
  if v_page2 is distinct from array['20000000-0000-0000-0000-000000000001']::uuid[] then
    raise exception 'FALLO TEST8: segunda página de proyectos %, esperado [P1]', v_page2;
  end if;

  -- Límite acotado por la BD: 0 → 1, 999 → 50.
  select count(*) into v_cnt from public.search_profiles(p_limit => 0);
  if v_cnt <> 1 then
    raise exception 'FALLO TEST8: el límite 0 no se acotó a 1 (devuelve %)', v_cnt;
  end if;
  select count(*) into v_cnt from public.search_profiles(p_limit => 999);
  if v_cnt <> 4 then
    raise exception 'FALLO TEST8: con límite 999 debería devolver todos (devuelve %)', v_cnt;
  end if;

  raise notice 'PASS TEST8: paginación por cursor sin solapes y límite acotado';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Limpieza: nada de lo anterior persiste.
-- ---------------------------------------------------------------------------
raise notice 'TODOS LOS TESTS DE FASE 5 (BÚSQUEDA) PASARON';
rollback;
