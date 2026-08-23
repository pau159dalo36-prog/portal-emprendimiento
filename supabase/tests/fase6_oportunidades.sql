-- ============================================================================
-- FASE 6 — Verificación del mercado de oportunidades
-- ============================================================================
-- Script SQL que comprueba los comportamientos exigidos por la migración
-- 20260817000000_fase6_oportunidades.sql:
--
--   1. ACL explícita (revoke-first): anon y authenticated leen `opportunities`;
--      solo authenticated inserta/actualiza; NADIE borra (sin política DELETE,
--      el ciclo de vida es por estados). `search_opportunities` y el predicado
--      `opportunity_is_publicly_distributable` están concedidos a ambos roles;
--      las funciones de moderación solo a authenticated (fail-closed interno
--      con is_platform_admin()).
--   2. Constraints de la tabla: tipos de oportunidad, alcance de empleo (solo
--      job/internship), turnos de 1 día (fechas/plazas), compensación monetaria
--      (currency + period + min<=max) y period restringido en turnos.
--   3. Trigger de ciclo de vida: solo se crea draft/published; moderación solo
--      admin; no se publica un turno ya pasado; `published_at` se fija al
--      publicar.
--   4. Sync oportunidad → post (idempotente): publicar crea/actualiza EXACTAMENTE
--      1 post `opportunity` publicado; filled → hidden; cancelled y
--      rejected/flagged → removed; draft → draft.
--   5. RLS: público solo lee distributivas `public`; el creador ve lo suyo;
--      `registered_users` para autenticados; `project_members` solo para
--      miembros; admin lo ve todo (moderación). Insert/update restringidos a
--      creador, miembro real del proyecto/org o admin.
--   6. RPC `search_opportunities`: fail-closed (proyecto no público excluido,
--      turnos terminados fuera), filtros (type/industry/work_mode/experience/
--      first_job/student/location/date), normalización (acentos/case), cursor
--      keyset sin solape y límite acotado a [1,50].
--   7. Feed "Para ti": excluye posts de oportunidad (post_type = 'video').
--
-- Cómo ejecutarlo (stack LOCAL de Supabase, como postgres, tras aplicar las
-- migraciones 20260731 → 20260817):
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fase6_oportunidades.sql
--
-- Requiere superusuario (postgres) para `set local role` y para fijar
-- `request.jwt.claims`. NO ejecutar contra la base remota. Todo el script va en
-- una transacción que se REVIERTE al final: no deja datos ni cambios.
--
-- Los tests de sync y moderación usan oportunidades DESECHABLES (OP11..OP14)
-- que se borran al final del test (postgres superusuario): el conjunto canónico
-- OP1..OP10 permanece intacto para los conteos de RLS/search.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Setup: identidades, perfiles, proyectos, organizaciones y membresías (como
-- postgres, RLS omitido). Las oportunidades se insertan directas en estado
-- inicial y la moderación (approved/flagged) se aplica DESPUÉS con las
-- funciones administrativas, igual que fase4/fase5.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.local',    extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.local',    extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local',    extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, username, full_name, headline, is_public, created_at)
values
  ('00000000-0000-0000-0000-000000000001', 'owner',    'Owner',    'Emprendedor', true,  now() - interval '6 days'),
  ('00000000-0000-0000-0000-000000000002', 'other',    'Other',    'Colaborador', true,  now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000003', 'admin',    'Admin',    'Administrador', true, now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000004', 'outsider', 'Outsider', 'Ajeno',       true,  now() - interval '3 days');

insert into public.projects (id, owner_id, organization_id, slug, name, tagline, description, stage, status, is_public, industries, created_at)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'plataforma-videojuegos', 'Plataforma de videojuegos', 'Juegos indie', 'Desarrollamos videojuegos', 'idea', 'published', true,  array['tecnologia'], now() - interval '4 days'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', null,                                 'proyecto-privado',        'Proyecto privado',          null,          null,                          'idea', 'published', false, array['otros'],       now() - interval '4 days');

insert into public.organizations (id, owner_id, slug, name, headline, description, location, industries, is_public, created_at)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'gamelab', 'Estudio Gamelab', 'Estudio de videojuegos', 'Creamos juegos', 'Madrid', array['tecnologia'], true,  now() - interval '4 days'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'org-oculta', 'Organización Oculta', null, null, null, array['otros'], false, now() - interval '4 days');

insert into public.project_members (project_id, profile_id, role, created_at)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', now() - interval '4 days'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'contributor', now() - interval '4 days');

insert into public.organization_members (organization_id, profile_id, role, created_at)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', now() - interval '4 days');

-- Oportunidades (estado inicial todo unreviewed; la moderación se aplica luego):
-- OP1  published/public/collaboration/Madrid     → distribuible
-- OP2  published/public/internship (junior/hybrid, 1er empleo, monetaria)
-- OP3  published/registered_users/job            → solo autenticados
-- OP4  published/project_members (proyecto P1)   → solo miembros de P1
-- OP5  draft/public (del creador)                → solo el creador
-- OP6  published/public (se flaggearà como admin) → NO distribuible
-- OP7  published/public/one_day_shift futuro      → distribuible (p_date)
-- OP8  published/public/one_day_shift terminado   → NO distribuible
-- OP9  published/public colgando de P2 (privado)  → RLS lo ve, search NO
-- OP10 published/public de other (se rechazará)   → NO distribuible
insert into public.opportunities (
  id, creator_id, project_id, organization_id, title, description, opportunity_type,
  employment_type, experience_level, work_mode, industry, country, region, city,
  location_text, status, visibility, moderation_status,
  is_first_job_friendly, is_student_friendly,
  compensation_type, compensation_min, compensation_max, currency, compensation_period,
  starts_at, ends_at, slots_total, published_at, created_at
)
values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', null, null, 'Busco cofundador técnico', 'Necesito un cofundador con perfil de ingeniería para la plataforma.', 'collaboration', null, null, null, 'tecnologia', 'ES', 'Madrid', 'Madrid', 'Oficina en Madrid centro', 'published', 'public', 'unreviewed', false, false, 'equity', null, null, null, null, null, null, null, now(), now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', null, null, 'Prácticas de ingeniería frontend', 'Buscamos estudiantes para prácticas remuneradas en Madrid.', 'internship', 'full_time', 'junior', 'hybrid', 'tecnologia', 'ES', 'Madrid', 'Madrid', null, 'published', 'public', 'unreviewed', true, true, 'monetary', 900, 1200, 'EUR', 'month', null, null, null, now(), now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', null, null, 'Desarrollador fullstack', 'Oferta para perfiles senior con remoto total.', 'job', 'full_time', 'senior', 'remote', 'tecnologia', 'ES', null, 'Barcelona', null, 'published', 'registered_users', 'unreviewed', false, false, 'negotiable', null, null, null, null, null, null, null, now(), now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', null, 'Cofundador para el estudio', 'Oportunidad interna del proyecto Gamelab.', 'cofounder', null, null, null, 'tecnologia', 'ES', 'Madrid', 'Madrid', null, 'published', 'project_members', 'unreviewed', false, false, 'negotiable', null, null, null, null, null, null, null, now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', null, null, 'Borrador interno', 'Oportunidad aún en preparación, no debe salir al mercado.', 'collaboration', null, null, null, 'otros', 'ES', null, 'Madrid', null, 'draft', 'public', 'unreviewed', false, false, 'negotiable', null, null, null, null, null, null, null, null, now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', null, null, 'Colaboración sospechosa', 'Oportunidad que el equipo de moderación marcará.', 'collaboration', null, null, null, 'otros', 'ES', null, 'Sevilla', null, 'published', 'public', 'unreviewed', false, false, 'unpaid', null, null, null, null, null, null, null, now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', null, null, 'Voluntariado fin de semana', 'Ayuda puntual el próximo fin de semana en el evento.', 'one_day_shift', null, null, null, 'cultura', 'ES', null, 'Valencia', null, 'published', 'public', 'unreviewed', false, false, 'unpaid', null, null, null, null, date_trunc('day', now()) + interval '3 days' + interval '10 hours', date_trunc('day', now()) + interval '3 days' + interval '18 hours', 10, now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', null, null, 'Turno ya celebrado', 'Este turno terminó ayer y no debe aparecer.', 'one_day_shift', null, null, null, 'cultura', 'ES', null, 'Valencia', null, 'published', 'public', 'unreviewed', false, false, 'unpaid', null, null, null, null, now() - interval '2 days' + interval '10 hours', now() - interval '2 days' + interval '18 hours', 5, now() - interval '2 days', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', null, 'Colaboración en proyecto privado', 'Oportunidad del proyecto no público: fuera del mercado.', 'collaboration', null, null, null, 'otros', 'ES', null, 'Madrid', null, 'published', 'public', 'unreviewed', false, false, 'negotiable', null, null, null, null, null, null, null, now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', null, null, 'Oferta duplicada', 'Contenido duplicado que el equipo rechazará.', 'job', 'part_time', 'mid', 'on_site', 'otros', 'ES', null, 'Madrid', null, 'published', 'public', 'unreviewed', false, false, 'negotiable', null, null, null, null, null, null, null, now(), now() - interval '1 day');

-- Moderación administrativa (como admin): OP2 aprobada y OP6 marcada. OP10 se
-- rechaza en el TEST 6 (moderación) para no alterar los conteos antes de tiempo.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select public.admin_approve_opportunity('40000000-0000-0000-0000-000000000002');
select public.admin_flag_opportunity('40000000-0000-0000-0000-000000000006', 'marca temporal');

reset role;
select set_config('request.jwt.claims', '', true);

-- ============================================================================
-- TEST 1 — ACL y distribución base
-- ============================================================================
set local role anon;

do $$
begin
  -- anon ve 4: OP1, OP2, OP7 y OP9 (distributivas + public).
  if (select count(*) from public.opportunities) <> 4 then
    raise exception 'FALLO TEST1a: anon ve % oportunidades (esperado 4)', (select count(*) from public.opportunities);
  end if;
  if exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000008') then
    raise exception 'FALLO TEST1a: anon ve un turno ya terminado (OP8)';
  end if;
  if exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000006') then
    raise exception 'FALLO TEST1a: anon ve una oportunidad marcada (OP6)';
  end if;
  if exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000010') then
    raise exception 'FALLO TEST1a: anon ve una oportunidad rechazada (OP10)';
  end if;
  if exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000003') then
    raise exception 'FALLO TEST1a: anon ve una oportunidad registered_users (OP3)';
  end if;
  if exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000004') then
    raise exception 'FALLO TEST1a: anon ve una oportunidad project_members (OP4)';
  end if;
  if exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000005') then
    raise exception 'FALLO TEST1a: anon ve un borrador (OP5)';
  end if;
  raise notice 'PASS TEST1a: anon solo ve distributivas públicas';
end $$;

do $$
begin
  perform * from public.search_opportunities();
  raise notice 'PASS TEST1b: anon puede ejecutar search_opportunities';
exception
  when others then
    raise exception 'FALLO TEST1b: anon no pudo ejecutar search_opportunities (%)', sqlerrm;
end $$;

do $$
begin
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, status)
    values ('00000000-0000-0000-0000-000000000002', 'Intento anon', 'Una descripción suficientemente larga', 'collaboration', 'draft');
    raise exception 'FALLO TEST1c: anon pudo insertar una oportunidad (sin grant)';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'FALLO TEST1c: error inesperado (%)', sqlerrm;
  end;
  begin
    delete from public.opportunities where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'FALLO TEST1c: anon pudo borrar una oportunidad (sin grant DELETE)';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'FALLO TEST1c: el borrado de anon falló con error inesperado (%)', sqlerrm;
  end;
  raise notice 'PASS TEST1c: anon no inserta ni borra';
end $$;

reset role;

-- ============================================================================
-- TEST 2 — RLS para authenticated: registered_users, project_members, propio
-- ============================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  -- other: 4 anónimas (OP1,OP2,OP7,OP9) + OP3 (registered_users) + OP4 (miembro P1)
  if (select count(*) from public.opportunities) <> 6 then
    raise exception 'FALLO TEST2a: other ve % oportunidades (esperado 6)', (select count(*) from public.opportunities);
  end if;
  if not exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000003') then
    raise exception 'FALLO TEST2a: other no ve OP3 (registered_users)';
  end if;
  if not exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000004') then
    raise exception 'FALLO TEST2a: other (miembro de P1) no ve OP4 (project_members)';
  end if;
  raise notice 'PASS TEST2a: authenticated ve registered_users y project_members (miembro)';
end $$;

do $$
begin
  update public.opportunities
  set title = 'Editado por miembro'
  where id = '40000000-0000-0000-0000-000000000004';
  if not found then
    raise exception 'FALLO TEST2b: un miembro de P1 no pudo gestionar OP4';
  end if;
  if not exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000004' and title = 'Editado por miembro') then
    raise exception 'FALLO TEST2b: el update de OP4 por miembro no surtió efecto';
  end if;
  update public.opportunities
  set title = 'Intento ajeno'
  where id = '40000000-0000-0000-0000-000000000001';
  if found then
    raise exception 'FALLO TEST2b: other pudo editar la oportunidad del creador (OP1)';
  end if;
  begin
    delete from public.opportunities where id = '40000000-0000-0000-0000-000000000004';
    raise exception 'FALLO TEST2b: other pudo borrar OP4 (sin grant DELETE)';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'FALLO TEST2b: borrar OP4 falló con error inesperado (%)', sqlerrm;
  end;
  raise notice 'PASS TEST2b: update solo para creador/miembro/admin; DELETE denegado';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- El creador ve su borrador y sus moderadas.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
begin
  -- owner ve 9 propias (OP1..OP9); OP10 es de other.
  if (select count(*) from public.opportunities) <> 9 then
    raise exception 'FALLO TEST2c: owner ve % oportunidades (esperado 9)', (select count(*) from public.opportunities);
  end if;
  if not exists (select 1 from public.opportunities where id = '40000000-0000-0000-0000-000000000005') then
    raise exception 'FALLO TEST2c: owner no ve su propio borrador (OP5)';
  end if;
  raise notice 'PASS TEST2c: el creador ve lo suyo (borradores y moderadas)';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- El admin lo ve todo (panel de moderación).
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);

do $$
begin
  if (select count(*) from public.opportunities) <> 10 then
    raise exception 'FALLO TEST2d: admin no ve las 10 oportunidades';
  end if;
  raise notice 'PASS TEST2d: el admin lo ve todo';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ============================================================================
-- TEST 3 — Constraints de la tabla
-- ============================================================================
do $$
begin
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, status)
    values ('00000000-0000-0000-0000-000000000002', 'Tipo inválido', 'Una descripción suficientemente larga para pasar', 'contrato', 'draft');
    raise exception 'FALLO TEST3a: se aceptó un opportunity_type inválido';
  exception
    when check_violation then null;
    when others then raise exception 'FALLO TEST3a: error inesperado (%)', sqlerrm;
  end;
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, employment_type, status)
    values ('00000000-0000-0000-0000-000000000002', 'Job sin modo', 'Una descripción suficientemente larga para pasar', 'job', 'full_time', 'draft');
    raise exception 'FALLO TEST3b: se aceptó un job sin work_mode';
  exception
    when check_violation then null;
    when others then raise exception 'FALLO TEST3b: error inesperado (%)', sqlerrm;
  end;
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, employment_type, work_mode, status)
    values ('00000000-0000-0000-0000-000000000002', 'Job con empleo pero sin compensación', 'Una descripción suficientemente larga para pasar', 'job', 'part_time', 'on_site', 'draft');
    raise exception 'FALLO TEST3c: se aceptó un job sin compensation_type/scope';
  exception
    when check_violation then null;
    when others then raise exception 'FALLO TEST3c: error inesperado (%)', sqlerrm;
  end;
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, status, compensation_type, compensation_min, currency, compensation_period)
    values ('00000000-0000-0000-0000-000000000002', 'Monetaria sin moneda', 'Una descripción suficientemente larga para pasar', 'collaboration', 'draft', 'monetary', 100, null, 'month');
    raise exception 'FALLO TEST3d: se aceptó compensación monetaria sin currency';
  exception
    when check_violation then null;
    when others then raise exception 'FALLO TEST3d: error inesperado (%)', sqlerrm;
  end;
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, status, compensation_type, compensation_min, compensation_max, currency, compensation_period)
    values ('00000000-0000-0000-0000-000000000002', 'Rango invertido', 'Una descripción suficientemente larga para pasar', 'collaboration', 'draft', 'monetary', 500, 100, 'EUR', 'month');
    raise exception 'FALLO TEST3e: se aceptó un rango con min > max';
  exception
    when check_violation then null;
    when others then raise exception 'FALLO TEST3e: error inesperado (%)', sqlerrm;
  end;
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, status, starts_at, ends_at, slots_total)
    values ('00000000-0000-0000-0000-000000000002', 'Turno sin plazas', 'Una descripción suficientemente larga para pasar', 'one_day_shift', 'draft', now() + interval '1 day', now() + interval '2 days', null);
    raise exception 'FALLO TEST3f: se aceptó un turno sin slots_total';
  exception
    when check_violation then null;
    when others then raise exception 'FALLO TEST3f: error inesperado (%)', sqlerrm;
  end;
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, status, compensation_type, compensation_min, currency, compensation_period, starts_at, ends_at, slots_total)
    values ('00000000-0000-0000-0000-000000000002', 'Turno monetario por mes', 'Una descripción suficientemente larga para pasar', 'one_day_shift', 'draft', 'monetary', 50, 'EUR', 'month', now() + interval '1 day', now() + interval '2 days', 3);
    raise exception 'FALLO TEST3g: se aceptó un turno monetario con periodo month';
  exception
    when check_violation then null;
    when others then raise exception 'FALLO TEST3g: error inesperado (%)', sqlerrm;
  end;
  raise notice 'PASS TEST3: las constraints rechazan datos inválidos';
end $$;

-- ============================================================================
-- TEST 4 — Trigger de ciclo de vida
-- ============================================================================
do $$
declare v_id uuid;
begin
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, status)
    values ('00000000-0000-0000-0000-000000000002', 'Nace cerrada', 'Una descripción suficientemente larga para pasar', 'collaboration', 'closed');
    raise exception 'FALLO TEST4a: se creó una oportunidad ya cerrada';
  exception
    when others then
      if sqlerrm not like '%solo puede crearse como borrador o publicada%' then
        raise exception 'FALLO TEST4a: error inesperado (%)', sqlerrm;
      end if;
  end;
  begin
    insert into public.opportunities (creator_id, title, description, opportunity_type, status, moderation_status, moderated_at)
    values ('00000000-0000-0000-0000-000000000002', 'Autoaprobada', 'Una descripción suficientemente larga para pasar', 'collaboration', 'draft', 'approved', now());
    raise exception 'FALLO TEST4b: un no-admin creó una oportunidad moderada';
  exception
    when others then
      if sqlerrm not like '%la moderación solo puede gestionarla un administrador%' then
        raise exception 'FALLO TEST4b: error inesperado (%)', sqlerrm;
      end if;
  end;
  insert into public.opportunities (creator_id, title, description, opportunity_type, status, starts_at, ends_at, slots_total)
  values ('00000000-0000-0000-0000-000000000002', 'Turno a publicar', 'Una descripción suficientemente larga para pasar', 'one_day_shift', 'draft', now() - interval '1 day', now() - interval '1 day' + interval '8 hours', 2)
  returning id into v_id;
  begin
    update public.opportunities set status = 'published' where id = v_id;
    raise exception 'FALLO TEST4c: se publicó un turno ya pasado';
  exception
    when others then
      if sqlerrm not like '%no se puede publicar una oportunidad de turno ya pasada%' then
        raise exception 'FALLO TEST4c: error inesperado (%)', sqlerrm;
      end if;
  end;
  insert into public.opportunities (creator_id, title, description, opportunity_type, status, compensation_type)
  values ('00000000-0000-0000-0000-000000000002', 'Publicación limpia', 'Una descripción suficientemente larga para pasar', 'collaboration', 'published', 'negotiable')
  returning id into v_id;
  if not exists (select 1 from public.opportunities where id = v_id and published_at is not null) then
    raise exception 'FALLO TEST4d: publicar no fijó published_at';
  end if;
  -- Limpieza de las oportunidades desechables del TEST4.
  delete from public.opportunities where id = v_id;
  raise notice 'PASS TEST4: el trigger valida el ciclo de vida';
end $$;

-- ============================================================================
-- TEST 5 — Sync oportunidad → post (idempotente) con oportunidades desechables
-- ============================================================================
do $$
declare
  v_id uuid;
  v_cnt int;
begin
  -- Publicar crea EXACTAMENTE 1 post `opportunity` publicado con published_at.
  insert into public.opportunities (creator_id, title, description, opportunity_type, status, compensation_type)
  values ('00000000-0000-0000-0000-000000000002', 'Desechable publicada', 'Una descripción suficientemente larga para pasar', 'collaboration', 'published', 'negotiable')
  returning id into v_id;
  select count(*) into v_cnt from public.posts where opportunity_id = v_id;
  if v_cnt <> 1 then
    raise exception 'FALLO TEST5a: publicar creó % posts (esperado 1)', v_cnt;
  end if;
  if not exists (
    select 1 from public.posts
    where opportunity_id = v_id and post_type = 'opportunity'
      and publication_status = 'published' and published_at is not null
  ) then
    raise exception 'FALLO TEST5a: el post no está publicado con post_type opportunity';
  end if;
  -- Idempotencia: actualizar la oportunidad no duplica posts.
  update public.opportunities set title = 'Desechable publicada (v2)' where id = v_id;
  select count(*) into v_cnt from public.posts where opportunity_id = v_id;
  if v_cnt <> 1 then
    raise exception 'FALLO TEST5b: tras el update hay % posts (esperado 1)', v_cnt;
  end if;
  -- filled → post hidden.
  update public.opportunities set status = 'filled' where id = v_id;
  if not exists (
    select 1 from public.posts where opportunity_id = v_id and publication_status = 'hidden'
  ) then
    raise exception 'FALLO TEST5c: filled no ocultó el post';
  end if;
  delete from public.opportunities where id = v_id;

  -- draft → publish → post publicado; volver a draft → post draft.
  insert into public.opportunities (creator_id, title, description, opportunity_type, status, compensation_type)
  values ('00000000-0000-0000-0000-000000000002', 'Desechable borrador', 'Una descripción suficientemente larga para pasar', 'collaboration', 'draft', 'negotiable')
  returning id into v_id;
  if exists (
    select 1 from public.posts where opportunity_id = v_id and publication_status = 'published'
  ) then
    raise exception 'FALLO TEST5d: un borrador generó un post publicado';
  end if;
  update public.opportunities set status = 'published' where id = v_id;
  if not exists (
    select 1 from public.posts where opportunity_id = v_id and publication_status = 'published'
  ) then
    raise exception 'FALLO TEST5d: publicar el borrador no creó el post publicado';
  end if;
  update public.opportunities set status = 'draft' where id = v_id;
  if not exists (
    select 1 from public.posts where opportunity_id = v_id and publication_status = 'draft'
  ) then
    raise exception 'FALLO TEST5d: volver a draft no degradó el post a draft';
  end if;
  delete from public.opportunities where id = v_id;

  -- cancelled → post removed.
  insert into public.opportunities (creator_id, title, description, opportunity_type, status, compensation_type)
  values ('00000000-0000-0000-0000-000000000002', 'Desechable cancelada', 'Una descripción suficientemente larga para pasar', 'collaboration', 'published', 'negotiable')
  returning id into v_id;
  update public.opportunities set status = 'cancelled' where id = v_id;
  if not exists (
    select 1 from public.posts where opportunity_id = v_id and publication_status = 'removed'
  ) then
    raise exception 'FALLO TEST5e: cancelar no eliminó (removed) el post';
  end if;
  delete from public.opportunities where id = v_id;

  raise notice 'PASS TEST5: el sync oportunidad → post es idempotente y coherente';
end $$;

-- ============================================================================
-- TEST 6 — Moderación administrativa
-- ============================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  begin
    perform public.admin_approve_opportunity('40000000-0000-0000-0000-000000000001');
    raise exception 'FALLO TEST6a: un no-admin aprobó una oportunidad';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm not like '%permiso denegado%' then
        raise exception 'FALLO TEST6a: error inesperado (%)', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST6a: la moderación falla para no-admin';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);

do $$
declare
  v_id uuid;
  v_cnt int;
begin
  -- Aprobar OP1: sigue siendo distribuible (approved) y su post queda publicado.
  perform public.admin_approve_opportunity('40000000-0000-0000-0000-000000000001');
  if not exists (
    select 1 from public.opportunities
    where id = '40000000-0000-0000-0000-000000000001' and moderation_status = 'approved'
  ) then
    raise exception 'FALLO TEST6b: admin_approve no cambió el estado';
  end if;
  select count(*) into v_cnt from public.posts where opportunity_id = '40000000-0000-0000-0000-000000000001';
  if v_cnt <> 1 then
    raise exception 'FALLO TEST6b: aprobar duplicó el post de OP1 (%)', v_cnt;
  end if;
  -- El admin no puede moderar lo suyo.
  insert into public.opportunities (creator_id, title, description, opportunity_type, status, moderation_status, moderated_at)
  values ('00000000-0000-0000-0000-000000000003', 'Mi propia oportunidad', 'Una descripción suficientemente larga para pasar', 'collaboration', 'draft', 'unreviewed', null)
  returning id into v_id;
  begin
    perform public.admin_approve_opportunity(v_id);
    raise exception 'FALLO TEST6c: el admin moderó su propia oportunidad';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm not like '%no puede moderar sus propias%' then
        raise exception 'FALLO TEST6c: error inesperado (%)', sqlerrm;
      end if;
  end;
  delete from public.opportunities where id = v_id;
  -- Rechazar OP10 (de other): el post asociado pasa a removed.
  perform public.admin_reject_opportunity('40000000-0000-0000-0000-000000000010', 'duplicado');
  if not exists (
    select 1 from public.posts
    where opportunity_id = '40000000-0000-0000-0000-000000000010' and publication_status = 'removed'
  ) then
    raise exception 'FALLO TEST6d: rechazar no eliminó (removed) el post de OP10';
  end if;
  raise notice 'PASS TEST6b/c/d: el admin modera, pero nunca lo propio';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ============================================================================
-- TEST 7 — search_opportunities
-- ============================================================================
set local role anon;

do $$
begin
  -- Browse: solo distributivas públicas y con contexto público. OP9 cuelga de
  -- un proyecto no público → fail-closed. Esperado: OP1, OP2, OP7 (3).
  if (select count(*) from public.search_opportunities()) <> 3 then
    raise exception 'FALLO TEST7a: browse devolvió % filas (esperado 3)', (select count(*) from public.search_opportunities());
  end if;
  if exists (select 1 from public.search_opportunities() where opportunity_id = '40000000-0000-0000-0000-000000000009') then
    raise exception 'FALLO TEST7a: browse incluyó una oportunidad de proyecto no público (OP9)';
  end if;
  if exists (select 1 from public.search_opportunities() where opportunity_id = '40000000-0000-0000-0000-000000000008') then
    raise exception 'FALLO TEST7a: browse incluyó un turno terminado (OP8)';
  end if;
  if exists (select 1 from public.search_opportunities() where opportunity_id = '40000000-0000-0000-0000-000000000006') then
    raise exception 'FALLO TEST7a: browse incluyó una oportunidad marcada (OP6)';
  end if;
  -- Filtros.
  if (select count(*) from public.search_opportunities(p_opportunity_type => 'internship')) <> 1 then
    raise exception 'FALLO TEST7b: filtro internship';
  end if;
  if (select count(*) from public.search_opportunities(p_industry => 'tecnologia')) <> 2 then
    raise exception 'FALLO TEST7b: filtro industria tecnologia';
  end if;
  if (select count(*) from public.search_opportunities(p_work_mode => 'hybrid')) <> 1 then
    raise exception 'FALLO TEST7b: filtro hybrid';
  end if;
  if (select count(*) from public.search_opportunities(p_experience_level => 'junior')) <> 1 then
    raise exception 'FALLO TEST7b: filtro junior';
  end if;
  if (select count(*) from public.search_opportunities(p_first_job_friendly => true)) <> 1 then
    raise exception 'FALLO TEST7b: filtro first_job';
  end if;
  if (select count(*) from public.search_opportunities(p_student_friendly => true)) <> 1 then
    raise exception 'FALLO TEST7b: filtro student_friendly';
  end if;
  if (select count(*) from public.search_opportunities(p_location => 'Madrid')) <> 2 then
    raise exception 'FALLO TEST7b: filtro ubicación Madrid';
  end if;
  if (select count(*) from public.search_opportunities(
        p_date => to_char(date_trunc('day', now()) + interval '3 days', 'YYYY-MM-DD'))) <> 1 then
    raise exception 'FALLO TEST7b: filtro fecha del turno';
  end if;
  -- Búsqueda con normalización (case y acentos).
  if (select count(*) from public.search_opportunities(p_query => 'cofundador')) <> 1 then
    raise exception 'FALLO TEST7b: query cofundador';
  end if;
  if (select count(*) from public.search_opportunities(p_query => 'COFUNDADOR TÉCNICO')) <> 1 then
    raise exception 'FALLO TEST7b: query normalizada';
  end if;
  if (select count(*) from public.search_opportunities(p_query => 'noexiste')) <> 0 then
    raise exception 'FALLO TEST7b: query sin coincidencias';
  end if;
  -- Límite acotado a [1,50] por la BD.
  if (select count(*) from public.search_opportunities(p_limit => 100)) <> 3 then
    raise exception 'FALLO TEST7c: limit=100';
  end if;
  if (select count(*) from public.search_opportunities(p_limit => 0)) <> 1 then
    raise exception 'FALLO TEST7c: limit=0 no se acotó a 1';
  end if;
  raise notice 'PASS TEST7a/b/c: distributividad, filtros, normalización y límite';
end $$;

-- Cobertura total sin solape: ids de ambas páginas = ids del browse completo.
do $$
declare
  v_p1 uuid[];
  v_last uuid;
  v_score numeric;
  v_created timestamptz;
  v_p2 uuid[];
  v_full uuid[];
  v_cov int;
begin
  v_full := array(select opportunity_id from public.search_opportunities());
  v_p1 := array(select opportunity_id from public.search_opportunities(p_limit => 2));
  select opportunity_id, search_score, created_at into v_last, v_score, v_created
  from public.search_opportunities(p_limit => 2)
  order by search_score desc, created_at desc, opportunity_id desc
  limit 1 offset 1;
  v_p2 := array(
    select opportunity_id from public.search_opportunities(
      p_limit => 2, p_cursor_score => v_score, p_cursor_created_at => v_created, p_cursor_id => v_last));
  if array_length(v_p2, 1) is distinct from 1 then
    raise exception 'FALLO TEST7d: página 2 incompleta (%)', array_length(v_p2, 1);
  end if;
  select count(*) into v_cov
  from unnest(v_full) f(id)
  where id <> all(v_p1) and id = any(v_p2);
  if v_cov <> 1 then
    raise exception 'FALLO TEST7d: las páginas no cubren el resultado sin solape';
  end if;
  raise notice 'PASS TEST7d: cursor keyset cubre todo el resultado sin solape';
end $$;

reset role;

-- ============================================================================
-- TEST 8 — Feed "Para ti": excluye posts de oportunidad
-- ============================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
begin
  if exists (select 1 from public.get_for_you_feed(20) where post_type = 'opportunity') then
    raise exception 'FALLO TEST8: el feed incluyó posts de oportunidad';
  end if;
  raise notice 'PASS TEST8: el feed excluye oportunidades';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ============================================================================
-- Resumen
-- ============================================================================
raise notice 'Todos los tests de FASE 6 (oportunidades) pasaron';

rollback;
