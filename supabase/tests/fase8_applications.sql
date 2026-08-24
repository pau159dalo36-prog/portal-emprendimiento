-- ============================================================================
-- FASE 8 — Verificación de invariantes (candidaturas a oportunidades)
-- ============================================================================
-- Script SQL que comprueba los comportamientos exigidos por la migración
-- 20260821000000_fase8_applications.sql:
--
--   1. ACL mínima (anon cero; authenticated sin DELETE; triggers internos
--      no invocables).
--   2. Alta propia, suplantación denegada, duplicado denegado, auto-postulación
--      denegada, mensaje normalizado.
--   3. Elegibilidad con el predicado canónico (draft/closed/filled/rejected/
--      flagged/cancelled/privado/turno pasado ⇒ no; turno futuro ⇒ sí).
--   4. Bloqueos en cualquier dirección ⇒ sin nuevas candidaturas.
--   5. Lectura: applicant lo propio; manager su oportunidad; outsider/anon nada.
--   6. Ciclo de vida y permisos finos por actor + inmutabilidad.
--   7. Perímetro manager personal/proyecto/organización.
--   8. Plazas one_day_shift derivadas (RPC fail-closed).
--   9. Outbox compartido: eventos application_* exactos y sin duplicados.
--
-- Cómo ejecutarlo (stack LOCAL de Supabase, como postgres, tras aplicar todas
-- las migraciones):
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fase8_applications.sql
--
-- Requiere superusuario (postgres). NO ejecutar contra la base remota. Todo el
-- script va en una transacción que se REVIERTE al final.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- Alias cortos de identidades de prueba:
--   alice = ...a1 (bloquea a bob) | bob = ...a2 (publicador)
--   carol = ...a3 (miembro proyecto) | dave = ...a4 (miembro organización)
--   eve = ...a5 (candidata principal)

-- ---------------------------------------------------------------------------
-- Setup: identidades, perfiles y oportunidades de prueba (como postgres)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice8@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob8@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol8@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave8@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve8@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username, full_name)
values
  ('00000000-0000-0000-0000-0000000000a1', 'alice8', 'Alice Fase8'),
  ('00000000-0000-0000-0000-0000000000a2', 'bob8', 'Bob Fase8'),
  ('00000000-0000-0000-0000-0000000000a3', 'carol8', 'Carol Fase8'),
  ('00000000-0000-0000-0000-0000000000a4', 'dave8', 'Dave Fase8'),
  ('00000000-0000-0000-0000-0000000000a5', 'eve8', 'Eve Fase8')
on conflict (id) do nothing;

-- Organización y proyecto anclados (owner: bob) con membresías reales.
insert into public.organizations (id, owner_id, name, slug, description)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2', 'Org Fase8', 'org-fase8', 'Organización de prueba')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, profile_id, role)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a4', 'member')
on conflict do nothing;

insert into public.projects (id, owner_id, name, slug, description, stage)
values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'Proyecto Fase8', 'proyecto-fase8', 'Proyecto de prueba', 'idea')
on conflict (id) do nothing;

insert into public.project_members (project_id, profile_id, role)
values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3', 'member')
on conflict do nothing;

-- Oportunidades de prueba (creator: bob).
insert into public.opportunities (
  id, creator_id, project_id, organization_id, title, description,
  opportunity_type, status, visibility, moderation_status, published_at,
  starts_at, ends_at, slots_total
)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Publicada personal', 'Descripción suficiente para validar.',
   'collaboration', 'published', 'public', 'unreviewed', now(),
   null, null, null),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Borrador', 'Descripción suficiente para validar.',
   'collaboration', 'draft', 'public', 'unreviewed', null,
   null, null, null),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Cerrada', 'Descripción suficiente para validar.',
   'job', 'closed', 'public', 'approved', now(),
   null, null, null),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Cubierta', 'Descripción suficiente para validar.',
   'internship', 'filled', 'public', 'approved', now(),
   null, null, null),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Rechazada', 'Descripción suficiente para validar.',
   'job', 'published', 'public', 'rejected', now(),
   null, null, null),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Marcada', 'Descripción suficiente para validar.',
   'job', 'published', 'public', 'flagged', now(),
   null, null, null),
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Turno futuro', 'Descripción suficiente para validar.',
   'one_day_shift', 'published', 'public', 'unreviewed', now(),
   now() + interval '2 days', now() + interval '2 days 8 hours', 2),
  ('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Turno pasado', 'Descripción suficiente para validar.',
   'one_day_shift', 'published', 'public', 'unreviewed', now(),
   now() - interval '2 days', now() - interval '1 day', 2),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Privada', 'Descripción suficiente para validar.',
   'collaboration', 'published', 'private', 'unreviewed', now(),
   null, null, null),
  ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000a2',
   null, null, 'Cancelada', 'Descripción suficiente para validar.',
   'collaboration', 'cancelled', 'public', 'unreviewed', now(),
   null, null, null),
  ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000b2', null, 'De proyecto', 'Descripción suficiente para validar.',
   'collaboration', 'published', 'public', 'unreviewed', now(),
   null, null, null),
  ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000a2',
   null, '00000000-0000-0000-0000-0000000000b1', 'De organización', 'Descripción suficiente para validar.',
   'collaboration', 'published', 'public', 'unreviewed', now(),
   null, null, null)
on conflict (id) do nothing;

-- Bloqueo alice → bob (el predicado profiles_can_interact es simétrico).
insert into public.profile_blocks (profile_id, blocked_id)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')
on conflict do nothing;

do $$
begin
  if (select count(*) from public.opportunities where id in (
    '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2',
    '00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000c4',
    '00000000-0000-0000-0000-0000000000c5','00000000-0000-0000-0000-0000000000c6',
    '00000000-0000-0000-0000-0000000000c7','00000000-0000-0000-0000-0000000000c8',
    '00000000-0000-0000-0000-0000000000c9','00000000-0000-0000-0000-0000000000ca',
    '00000000-0000-0000-0000-0000000000cb','00000000-0000-0000-0000-0000000000cc')) <> 12 then
    raise exception 'FALLO SETUP: oportunidades de prueba incompletas';
  end if;
  raise notice 'PASS SETUP: perfiles y oportunidades listos';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 1: ACL mínima (grants exactos, sin dependencia de defaults)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if has_table_privilege('anon', 'public.applications', 'SELECT')
    or has_table_privilege('anon', 'public.applications', 'INSERT')
    or has_table_privilege('anon', 'public.applications', 'UPDATE')
    or has_table_privilege('anon', 'public.applications', 'DELETE') then
    raise exception 'FALLO TEST1: anon tiene privilegios sobre applications';
  end if;
  if has_function_privilege('anon', 'public.can_manage_opportunity(uuid)', 'EXECUTE') then
    raise exception 'FALLO TEST1: anon puede ejecutar can_manage_opportunity';
  end if;
  if has_function_privilege('anon', 'public.get_application_counts(uuid[])', 'EXECUTE') then
    raise exception 'FALLO TEST1: anon puede ejecutar get_application_counts';
  end if;
  raise notice 'PASS TEST1: ACL correcta para anon';
end $$;

set local role postgres;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  fn text;
begin
  if not has_table_privilege('authenticated', 'public.applications', 'SELECT')
    or not has_table_privilege('authenticated', 'public.applications', 'INSERT')
    or not has_table_privilege('authenticated', 'public.applications', 'UPDATE') then
    raise exception 'FALLO TEST1: authenticated carece de select/insert/update';
  end if;
  if has_table_privilege('authenticated', 'public.applications', 'DELETE') then
    raise exception 'FALLO TEST1: authenticated tiene DELETE (debe usarse withdrawn)';
  end if;
  foreach fn in array array[
    'public.applications_normalize_message()',
    'public.applications_validate_transition()',
    'public.interaction_event_application_insert()',
    'public.interaction_event_application_update()'
  ]
  loop
    if has_function_privilege('authenticated', fn, 'EXECUTE') then
      raise exception 'FALLO TEST1: función interna invocable: %', fn;
    end if;
  end loop;
  raise notice 'PASS TEST1: ACL correcta para authenticated';
end $$;

set local role postgres;

-- ---------------------------------------------------------------------------
-- TEST 2: alta propia, suplantación, duplicado y auto-postulación
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_id uuid;
  v_status text;
  v_message text;
begin
  insert into public.applications (opportunity_id, applicant_id, message)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a5',
          '  Me interesa porque…  ')
  returning id into v_id;

  select status, message into v_status, v_message
  from public.applications where id = v_id;
  if v_status is distinct from 'submitted'
    or v_message is distinct from 'Me interesa porque…' then
    raise exception 'FALLO TEST2: estado inicial o normalización del mensaje incorrectos';
  end if;

  -- Duplicado: UNIQUE(opportunity_id, applicant_id).
  begin
    insert into public.applications (opportunity_id, applicant_id)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a5');
    raise exception 'FALLO TEST2: se aceptó una candidatura duplicada';
  exception
    when unique_violation then null;
  end;

  -- Suplantación: applicant_id distinto de auth.uid().
  begin
    insert into public.applications (opportunity_id, applicant_id)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a3');
    raise exception 'FALLO TEST2: se aceptó crear candidatura para otra persona';
  exception
    when others then
      if sqlerrm like '%FALLO TEST2%' then raise; end if;
  end;

  raise notice 'PASS TEST2: alta propia, normalización e idempotencia OK';
end $$;

set local role postgres;

-- Bob NO puede postularse a su propia oportunidad.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.applications (opportunity_id, applicant_id)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2');
    raise exception 'FALLO TEST2: el creador se autopostuló';
  exception
    when others then
      if sqlerrm like '%FALLO TEST2%' then raise; end if;
  end;
  raise notice 'PASS TEST2: auto-postulación denegada';
end $$;

set local role postgres;

-- ---------------------------------------------------------------------------
-- TEST 3: elegibilidad (predicado canónico de oportunidad distribuible)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_opp_id text;
begin
  foreach v_opp_id in array array[
    '00000000-0000-0000-0000-0000000000c2', -- draft
    '00000000-0000-0000-0000-0000000000c3', -- closed
    '00000000-0000-0000-0000-0000000000c4', -- filled
    '00000000-0000-0000-0000-0000000000c5', -- moderación rejected
    '00000000-0000-0000-0000-0000000000c6', -- moderación flagged
    '00000000-0000-0000-0000-0000000000c8', -- turno pasado
    '00000000-0000-0000-0000-0000000000c9', -- private
    '00000000-0000-0000-0000-0000000000ca'  -- cancelled
  ]
  loop
    begin
      insert into public.applications (opportunity_id, applicant_id)
      values (v_opp_id::uuid, '00000000-0000-0000-0000-0000000000a5');
      raise exception 'FALLO TEST3: se aceptó candidatura sobre %', v_opp_id;
    exception
      when others then
        if sqlerrm like '%FALLO TEST3%' then raise; end if;
    end;
  end loop;

  -- Turno FUTURO sí es elegible (segunda candidatura de eve, otra oportunidad).
  insert into public.applications (opportunity_id, applicant_id, message)
  values ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a5', null);

  raise notice 'PASS TEST3: elegibilidad correcta (no elegibles denegadas, turno futuro OK)';
end $$;

set local role postgres;

-- ---------------------------------------------------------------------------
-- TEST 4: bloqueos (alice bloqueó a bob ⇒ sin NUEVAS candidaturas)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.applications (opportunity_id, applicant_id)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FALLO TEST4: candidatura aceptada con bloqueo previo';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
  end;
  raise notice 'PASS TEST4: bloqueo impide nuevas candidaturas';
end $$;

set local role postgres;

-- Candidaturas adicionales para tests de lectura/gestión/plazas/outbox.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into public.applications (opportunity_id, applicant_id)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a3');
  insert into public.applications (opportunity_id, applicant_id)
  values ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a3');
end $$;
set local role postgres;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into public.applications (opportunity_id, applicant_id)
  values ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-0000000000a5');
  insert into public.applications (opportunity_id, applicant_id)
  values ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000a5');
end $$;
set local role postgres;

-- ---------------------------------------------------------------------------
-- TEST 5: lectura (RLS SELECT)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_count int;
begin
  -- Eve ve TODAS las suyas (4: c1, c7, cb, cc).
  select count(*) into v_count from public.applications
  where applicant_id = '00000000-0000-0000-0000-0000000000a5';
  if v_count <> 4 then
    raise exception 'FALLO TEST5: eve debería ver 4 propias, vio %', v_count;
  end if;

  -- Eve NO ve la candidatura de carol sobre c1.
  select count(*) into v_count from public.applications
  where applicant_id = '00000000-0000-0000-0000-0000000000a3'
    and opportunity_id = '00000000-0000-0000-0000-0000000000c1';
  if v_count <> 0 then
    raise exception 'FALLO TEST5: eve ve candidaturas ajenas';
  end if;
  raise notice 'PASS TEST5: applicant solo lee lo propio';
end $$;

set local role postgres;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.applications
  where opportunity_id = '00000000-0000-0000-0000-0000000000c1';
  if v_count <> 0 then
    raise exception 'FALLO TEST5: outsider ve candidaturas ajenas';
  end if;
  raise notice 'PASS TEST5: outsider sin visibilidad';
end $$;

set local role postgres;

-- Anon: sin privilegio de lectura directa.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  begin
    perform 1 from public.applications limit 1;
    raise exception 'FALLO TEST5: anon leyó applications';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%FALLO TEST5%' then raise; end if;
      raise exception 'FALLO TEST5: error inesperado para anon: %', sqlerrm;
  end;
  raise notice 'PASS TEST5: anon sin acceso';
end $$;

set local role postgres;

-- ---------------------------------------------------------------------------
-- Snapshot de las 6 candidaturas creadas (sin RLS, para referencias estables)
-- ---------------------------------------------------------------------------
create temp table fase8_apps as
select a.id, a.opportunity_id, a.applicant_id, a.status
from public.applications a;

do $$
begin
  if (select count(*) from fase8_apps) <> 6 then
    raise exception 'FALLO SETUP2: se esperaban 6 candidaturas, hay %',
      (select count(*) from fase8_apps);
  end if;
  raise notice 'PASS SETUP2: snapshot de candidaturas listo';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 6: ciclo de vida, permisos finos por actor e inmutabilidad
-- ---------------------------------------------------------------------------

-- 6a. Como EVE (solo candidata).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_eve_c1 uuid;
begin
  select id into v_eve_c1 from fase8_apps
  where opportunity_id = '00000000-0000-0000-0000-0000000000c1'
    and applicant_id   = '00000000-0000-0000-0000-0000000000a5';

  -- Mensaje editable mientras está pendiente.
  update public.applications set message = 'Mensaje mejorado.'
  where id = v_eve_c1;
  if (select message from public.applications where id = v_eve_c1)
      is distinct from 'Mensaje mejorado.' then
    raise exception 'FALLO TEST6: la candidata no pudo editar su mensaje pendiente';
  end if;

  -- La candidata NO decide estados (viewed es del manager).
  begin
    update public.applications set status = 'viewed' where id = v_eve_c1;
    raise exception 'FALLO TEST6: la candidata cambió el estado de su candidatura';
  exception
    when others then
      if sqlerrm like '%FALLO TEST6%' then raise; end if;
  end;

  -- Campos inmutables (applicant_id/opportunity_id/applied_at).
  begin
    update public.applications
    set applicant_id = '00000000-0000-0000-0000-0000000000a3'
    where id = v_eve_c1;
    raise exception 'FALLO TEST6: applicant_id resultó mutable';
  exception
    when others then
      if sqlerrm like '%FALLO TEST6%' then raise; end if;
  end;

  raise notice 'PASS TEST6a: candidata edita mensaje, no decide estados ni identidades';
end $$;

set local role postgres;

-- 6b. Como BOB (creador ⇒ manager de c1 y c7).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_eve_c1   uuid;
  v_eve_c7   uuid;
  v_carol_c1 uuid;
  v_carol_c7 uuid;
begin
  select id into v_eve_c1   from fase8_apps where opportunity_id = '00000000-0000-0000-0000-0000000000c1' and applicant_id = '00000000-0000-0000-0000-0000000000a5';
  select id into v_eve_c7   from fase8_apps where opportunity_id = '00000000-0000-0000-0000-0000000000c7' and applicant_id = '00000000-0000-0000-0000-0000000000a5';
  select id into v_carol_c1 from fase8_apps where opportunity_id = '00000000-0000-0000-0000-0000000000c1' and applicant_id = '00000000-0000-0000-0000-0000000000a3';
  select id into v_carol_c7 from fase8_apps where opportunity_id = '00000000-0000-0000-0000-0000000000c7' and applicant_id = '00000000-0000-0000-0000-0000000000a3';

  -- Transiciones válidas del manager: viewed ×3, rejected ×1.
  update public.applications set status = 'viewed' where id = v_eve_c1;
  update public.applications set status = 'viewed' where id = v_eve_c7;
  update public.applications set status = 'viewed' where id = v_carol_c7;
  update public.applications set status = 'rejected' where id = v_carol_c1;

  if (select status from public.applications where id = v_carol_c1)
      is distinct from 'rejected' then
    raise exception 'FALLO TEST6: rechazo del manager no aplicado';
  end if;

  -- El manager NO retira candidaturas (solo la persona que aplica).
  begin
    update public.applications set status = 'withdrawn' where id = v_eve_c1;
    raise exception 'FALLO TEST6: el manager retiró una candidatura ajena';
  exception
    when others then
      if sqlerrm like '%FALLO TEST6%' then raise; end if;
  end;

  -- Estado terminal rejected: sin nuevas transiciones.
  begin
    update public.applications set status = 'accepted' where id = v_carol_c1;
    raise exception 'FALLO TEST6: estado terminal rejected permitió nueva transición';
  exception
    when others then
      if sqlerrm like '%FALLO TEST6%' then raise; end if;
  end;

  -- El mensaje solo lo gestiona quien aplica.
  begin
    update public.applications set message = 'spoof' where id = v_carol_c1;
    raise exception 'FALLO TEST6: el manager editó el mensaje de la candidata';
  exception
    when others then
      if sqlerrm like '%FALLO TEST6%' then raise; end if;
  end;

  raise notice 'PASS TEST6b: transiciones del manager OK, reglas finas respetadas';
end $$;

set local role postgres;

-- 6c. Como CAROL (miembro del proyecto ⇒ manager SOLO de cb).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_eve_cb uuid;
  v_eve_c1 uuid;
  v_rc     bigint;
begin
  select id into v_eve_cb from fase8_apps
  where opportunity_id = '00000000-0000-0000-0000-0000000000cb';
  select id into v_eve_c1 from fase8_apps
  where opportunity_id = '00000000-0000-0000-0000-0000000000c1';

  update public.applications set status = 'accepted' where id = v_eve_cb;
  if (select status from public.applications where id = v_eve_cb)
      is distinct from 'accepted' then
    raise exception 'FALLO TEST6: miembro de proyecto no pudo aceptar';
  end if;

  -- Fuera de su perímetro: 0 filas afectadas (RLS), sin error.
  update public.applications set status = 'accepted' where id = v_eve_c1;
  get diagnostics v_rc = row_count;
  if v_rc <> 0 then
    raise exception 'FALLO TEST6: miembro de proyecto gestionó oportunidad ajena';
  end if;

  raise notice 'PASS TEST6c: perímetro de proyecto correcto';
end $$;

set local role postgres;

-- 6d. Como DAVE (miembro de la organización ⇒ manager SOLO de cc).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_eve_cc   uuid;
  v_carol_c7 uuid;
  v_rc       bigint;
begin
  select id into v_eve_cc from fase8_apps
  where opportunity_id = '00000000-0000-0000-0000-0000000000cc';
  select id into v_carol_c7 from fase8_apps
  where opportunity_id = '00000000-0000-0000-0000-0000000000c7';

  update public.applications set status = 'accepted' where id = v_eve_cc;
  if (select status from public.applications where id = v_eve_cc)
      is distinct from 'accepted' then
    raise exception 'FALLO TEST6: miembro de organización no pudo aceptar';
  end if;

  update public.applications set status = 'viewed' where id = v_carol_c7;
  get diagnostics v_rc = row_count;
  if v_rc <> 0 then
    raise exception 'FALLO TEST6: miembro de organización gestionó oportunidad ajena';
  end if;

  raise notice 'PASS TEST6d: perímetro de organización correcto';
end $$;

set local role postgres;

-- 6e. Como EVE: retirar la propia (viewed ⇒ withdrawn) y límites posteriores.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_eve_c7 uuid;
begin
  select id into v_eve_c7 from fase8_apps
  where opportunity_id = '00000000-0000-0000-0000-0000000000c7'
    and applicant_id   = '00000000-0000-0000-0000-0000000000a5';

  update public.applications set status = 'withdrawn' where id = v_eve_c7;
  if (select status from public.applications where id = v_eve_c7)
      is distinct from 'withdrawn' then
    raise exception 'FALLO TEST6: la candidata no pudo retirar su candidatura vista';
  end if;

  -- Re-postulación tras retiro: NO soportada en MVP (única compuesta).
  begin
    insert into public.applications (opportunity_id, applicant_id)
    values ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a5');
    raise exception 'FALLO TEST6: re-postulación aceptada tras retiro';
  exception
    when unique_violation then null;
  end;

  -- Mensaje bloqueado en estado terminal.
  begin
    update public.applications set message = 'tarde' where id = v_eve_c7;
    raise exception 'FALLO TEST6: mensaje editable en estado terminal';
  exception
    when others then
      if sqlerrm like '%FALLO TEST6%' then raise; end if;
  end;

  raise notice 'PASS TEST6e: retiro propio OK, re-postulación y edición denegadas';
end $$;

set local role postgres;

-- ---------------------------------------------------------------------------
-- TEST 7: visibilidad SELECT por perímetro manager
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.applications
  where opportunity_id = '00000000-0000-0000-0000-0000000000cb';
  if v_count <> 1 then
    raise exception 'FALLO TEST7: carol debería ver 1 candidatura de cb, vio %', v_count;
  end if;
  select count(*) into v_count from public.applications
  where opportunity_id = '00000000-0000-0000-0000-0000000000c1';
  if v_count <> 0 then
    raise exception 'FALLO TEST7: carol ve candidaturas de c1 (fuera de perímetro)';
  end if;
  raise notice 'PASS TEST7: lectura manager por proyecto correcta';
end $$;

set local role postgres;

-- ---------------------------------------------------------------------------
-- TEST 8: get_application_counts derivado y fail-closed
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  r        record;
  v_seen   int := 0;
  v_total  bigint;
  v_accept bigint;
begin
  for r in select * from public.get_application_counts(
      array['00000000-0000-0000-0000-0000000000cb',
            '00000000-0000-0000-0000-0000000000cc'])
  loop
    v_seen := v_seen + 1;
    if r.total is distinct from 1 or r.accepted_count is distinct from 1 then
      raise exception 'FALLO TEST8: conteos inesperados para %', r.opportunity_id;
    end if;
  end loop;
  if v_seen <> 2 then
    raise exception 'FALLO TEST8: se esperaban 2 filas de conteo, hubo %', v_seen;
  end if;

  select s.total, s.accepted_count
  into v_total, v_accept
  from public.get_application_counts(
    array['00000000-0000-0000-0000-0000000000c7']) s;
  if v_total is distinct from 2 or v_accept is distinct from 0 then
    raise exception 'FALLO TEST8: c7 debería tener total=2 aceptadas=0';
  end if;

  raise notice 'PASS TEST8: RPC de conteos correcta para manager';
end $$;

set local role postgres;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_rows int := 0;
begin
  for r_tmp in select * from public.get_application_counts(
      array['00000000-0000-0000-0000-0000000000cb',
            '00000000-0000-0000-0000-0000000000cc'])
  loop
    v_rows := v_rows + 1;
  end loop;
  if v_rows <> 0 then
    raise exception 'FALLO TEST8: no-manager recibió % filas de conteo', v_rows;
  end if;
  raise notice 'PASS TEST8: RPC fail-closed para no-manager';
end $$;

set local role postgres;

-- ---------------------------------------------------------------------------
-- TEST 9: outbox compartido (eventos application_* exactos)
-- ---------------------------------------------------------------------------
do $$
declare
  v_submitted  bigint;
  v_viewed     bigint;
  v_accepted   bigint;
  v_rejected   bigint;
  v_withdrawn  bigint;
  v_other      bigint;
begin
  select count(*) into v_submitted from public.interaction_events
  where event_type = 'application_submitted';
  select count(*) into v_viewed from public.interaction_events
  where event_type = 'application_viewed';
  select count(*) into v_accepted from public.interaction_events
  where event_type = 'application_accepted';
  select count(*) into v_rejected from public.interaction_events
  where event_type = 'application_rejected';
  select count(*) into v_withdrawn from public.interaction_events
  where event_type = 'application_withdrawn';
  select count(*) into v_other from public.interaction_events
  where event_type like 'application_%'
    and event_type not in (
      'application_submitted','application_viewed','application_accepted',
      'application_rejected','application_withdrawn');

  if v_submitted is distinct from 6
    or v_viewed    is distinct from 3
    or v_accepted  is distinct from 2
    or v_rejected  is distinct from 1
    or v_withdrawn is distinct from 1
    or v_other     is distinct from 0 then
    raise exception
      'FALLO TEST9: eventos fuera de lo esperado (submitted=%, viewed=%, accepted=%, rejected=%, withdrawn=%, otros=%)',
      v_submitted, v_viewed, v_accepted, v_rejected, v_withdrawn, v_other;
  end if;

  raise notice 'PASS TEST9: outbox exacto (submitted=6, viewed=3, accepted=2, rejected=1, withdrawn=1)';
end $$;

-- Estado final esperado de las 6 candidaturas:
--   eve/c1=viewed | eve/c7=withdrawn | carol/c1=rejected
--   carol/c7=viewed | eve/cb=accepted | eve/cc=accepted
do $$
begin
  if (select count(*) from public.applications
      where status = 'submitted') is distinct from 0 then
    raise exception 'FALLO FINAL: quedan candidaturas submitted';
  end if;
  raise notice 'FASE8: todos los tests pasaron (transacción se revertirá)';
end $$;

rollback;
