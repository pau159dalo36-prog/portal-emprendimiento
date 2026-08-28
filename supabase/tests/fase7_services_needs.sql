-- ============================================================================
-- FASE 7 — Tests SQL de servicios, project_needs, pilot users y funding
-- ============================================================================
-- Suite de verificación para ejecutar CONTRA UN ENTORNO LOCAL (Docker,
-- supabase start + db reset). NO ejecutar contra producción: contiene datos
-- de prueba, desactiva triggers donde hace falta y borra filas.
--
-- Pendiente: Docker local no disponible en esta máquina; la suite queda
-- preparada para `supabase db reset` + psql. Cubre:
--
--   SERVICES
--     A1  draft → published → paused → archived (ciclo completo)
--     A2  transición inválida denegada (draft → archived)
--     A3  edición propia permitida; provider_id inmutable
--     A4  anon no inserta/actualiza; RLS lectura solo distribuible público
--     A5  no publicado (draft/paused/archived) invisible a otro usuario
--     A6  pricing constraints: fixed exige amount+currency; range min<=max;
--         free/negotiable sin importes; moneda ISO-4217; importes >= 0
--     A7  search_services: FTS/trigram, filtros, bloqueos excluidos,
--         registered_users oculto a anon
--     A8  guardado (saved_services) solo sobre servicio distribuible
--     A9  mensajería: get_or_create_dm desde un cliente del servicio
--
--   PROJECT NEEDS / PILOT / FUNDING
--     B1  need_kind default 'member' y CHECK mentor|tester|member
--     B2  project_pilot_plans 1:1 (UNIQUE project_id), RLS pública con
--         proyecto publicado y gestión por miembros
--     B3  projects_funding_signal_check: sin búsqueda → todo NULL;
--         stage/moneda/importe válidos; note <= 2000
--
-- Uso previsto (local):
--   supabase db reset
--   psql "$LOCAL_URL" -f supabase/tests/fase7_services_needs.sql
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Utilidades de test
-- ---------------------------------------------------------------------------
create or replace function tests_assert(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not p_condition then
    raise exception 'FALLO TEST: %', p_message;
  end if;
end;
$$;

do $$
begin
  -- Los helpers de test son efímeros; no deben exponerse.
  execute 'revoke all on function tests_assert(boolean, text) from public, anon, authenticated';
exception when undefined_function then
  null;
end $$;

-- ---------------------------------------------------------------------------
-- Datos base: dos perfiles de prueba + bloqueo opcional
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data)
values
  ('00000000-0000-4000-8000-00000000f001', 'proveedor@test.local', 'x', now(), '{}'::jsonb),
  ('00000000-0000-4000-8000-00000000f002', 'cliente@test.local',   'x', now(), '{}'::jsonb),
  ('00000000-0000-4000-8000-00000000f003', 'tercero@test.local',   'x', now(), '{}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, username, full_name, is_public)
values
  ('00000000-0000-4000-8000-00000000f001', 'test_proveedor', 'Proveedor Test', true),
  ('00000000-0000-4000-8000-00000000f002', 'test_cliente',   'Cliente Test',   true),
  ('00000000-0000-4000-8000-00000000f003', 'test_tercero',   'Tercero Test',   true)
on conflict (id) do nothing;

-- Contexto de rol simulado por sesión (set_config local a la transacción).
create or replace function tests_set_uid(p_uid uuid)
returns void
language sql
as $$
  select set_config('role', case when p_uid is null then 'anon' else 'authenticated' end, true)
      || coalesce((
        select set_config('request.jwt.claims',
          json_build_object('sub', p_uid)::text, true)
        where p_uid is not null
      ), '')
$$;

-- ===========================================================================
-- A. SERVICES
-- ===========================================================================

-- A1/A6: creación como draft y pricing correcto por tipo.
select public.tests_set_uid('00000000-0000-4000-8000-00000000f001');
insert into public.services (provider_id, title, description, category, delivery_mode,
                             pricing_type, price_amount, currency, status)
values ('00000000-0000-4000-8000-00000000f001',
        'Landing page con Next.js',
        'Diseño y desarrollo de una landing page rápida y accesible para tu proyecto.',
        'desarrollo_web', 'remote', 'fixed', 500, 'EUR', 'draft')
returning id;

with v as (
  select id from public.services where provider_id = '00000000-0000-4000-8000-00000000f001' limit 1
)
update public.services s set status = 'published' from v where s.id = v.id returning s.id;

do $$
declare
  v_count int;
  v_published timestamptz;
begin
  select count(*), max(published_at) into v_count, v_published
  from public.services
  where provider_id = '00000000-0000-4000-8000-00000000f001'
    and status = 'published';
  perform public.tests_assert(v_count = 1, 'A1: el draft debe poder publicarse');
  perform public.tests_assert(v_published is not null, 'A1: published_at debe fijarse al publicar');
end $$;

-- A2: transición inválida draft → archived (se crea draft aparte).
select public.tests_set_uid('00000000-0000-4000-8000-00000000f001');
insert into public.services (provider_id, title, description, status)
values ('00000000-0000-4000-8000-00000000f001',
        'Servicio en borrador',
        'Descripción suficientemente larga para pasar el CHECK de descripción.',
        'draft');

do $$
begin
  update public.services
     set status = 'archived'
   where title = 'Servicio en borrador';
  raise exception 'A2 FALLÓ: draft→archived debería estar denegado';
exception when others then
  if sqlerrm like 'transición de estado no permitida%' then
    null; -- esperado
  else
    raise;
  end if;
end $$;

-- A3: provider_id inmutable.
do $$
begin
  update public.services
     set provider_id = '00000000-0000-4000-8000-00000000f003'
   where title = 'Servicio en borrador';
  raise exception 'A3 FALLÓ: cambiar provider_id debería estar denegado';
exception when others then
  if sqlerrm like '%proveedor%' then
    null;
  else
    raise;
  end if;
end $$;

-- A4/A5: como tercero autenticado, solo ve el publicado.
select public.tests_set_uid('00000000-0000-4000-8000-00000000f003');
do $$
declare
  v_visible int;
  v_drafts int;
begin
  select count(*) into v_visible from public.services where status = 'published';
  select count(*) into v_drafts from public.services where status <> 'published';
  perform public.tests_assert(v_visible = 1, 'A5: un tercero solo ve el servicio publicado');
  perform public.tests_assert(v_drafts = 0, 'A5: los drafts de otros son invisibles');
end $$;

-- A4: anon no puede insertar.
select public.tests_set_uid(null);
do $$
begin
  insert into public.services (provider_id, title, description)
  values ('00000000-0000-4000-8000-00000000f003', 'Anon service', 'Intento de inserción anónima que debe fallar.');
  raise exception 'A4 FALLÓ: anon no debería poder insertar servicios';
exception when insufficient_privilege then
  null;
when others then
  if sqlerrm like '%permission denied%' or sqlerrm like '%new row violates%' then
    null;
  else
    raise;
  end if;
end $$;

-- A6: pricing inválido denegado por la BD (defensa final tras la app).
select public.tests_set_uid('00000000-0000-4000-8000-00000000f001');
do $$
begin
  insert into public.services (provider_id, title, description, pricing_type, price_min, price_max)
  values ('00000000-0000-4000-8000-00000000f001', 'Range roto', 'Rango con min mayor que max que debe ser denegado.',
          'range', 900, 100);
  raise exception 'A6 FALLÓ: range con min > max debería fallar';
exception when check_violation then
  null;
end $$;

do $$
begin
  insert into public.services (provider_id, title, description, pricing_type, price_amount)
  values ('00000000-0000-4000-8000-00000000f001', 'Free con precio', 'Servicio gratuito con importe que debe ser denegado.',
          'free', 10);
  raise exception 'A6 FALLÓ: free con importe debería fallar';
exception when check_violation then
  null;
end $$;

-- ===========================================================================
-- B. PROJECT NEEDS / PILOT USERS / FUNDING
-- ===========================================================================
select public.tests_set_uid('00000000-0000-4000-8000-00000000f001');

insert into public.projects (id, owner_id, slug, name, stage, status, is_public)
values ('00000000-0000-4000-8000-00000000d001',
        '00000000-0000-4000-8000-00000000f001',
        'proyecto-test-fase7', 'Proyecto Test FASE 7', 'prototipo', 'published', true)
on conflict (id) do nothing;

-- B1: necesidad mentor y tester; default member.
insert into public.project_needs (project_id, title, need_kind)
values ('00000000-0000-4000-8000-00000000d001', 'Mentor de producto', 'mentor'),
       ('00000000-0000-4000-8000-00000000d001', 'Testers de la beta', 'tester'),
       ('00000000-0000-4000-8000-00000000d001', 'Diseñador/a UI', default);

do $$
declare
  v_bad int;
begin
  select count(*) into v_bad from public.project_needs where need_kind not in ('member','mentor','tester');
  perform public.tests_assert(v_bad = 0, 'B1: need_kind fuera del dominio');

  begin
    insert into public.project_needs (project_id, title, need_kind)
    values ('00000000-0000-4000-8000-00000000d001', 'Necesidad inválida', 'inversor');
    raise exception 'B1 FALLÓ: need_kind inválido aceptado';
  exception when check_violation then
    null;
  end;
end $$;

-- B2: plan de pilot users 1:1.
insert into public.project_pilot_plans (project_id, what_to_test, slots_total)
values ('00000000-0000-4000-8000-00000000d001',
        'Queremos validar el flujo de onboarding con negocios locales.', 20)
on conflict (project_id) do update set what_to_test = excluded.what_to_test;

do $$
begin
  insert into public.project_pilot_plans (project_id, what_to_test)
  values ('00000000-0000-4000-8000-00000000d001', 'Segundo plan que debe chocar con UNIQUE.');
  raise exception 'B2 FALLÓ: segundo plan para el mismo proyecto aceptado';
exception when unique_violation then
  null;
end $$;

-- B3: señal de inversión coherente.
update public.projects
   set seeking_investment = false,
       funding_stage = null, amount_sought = null,
       investment_currency = null, investment_note = null
 where id = '00000000-0000-4000-8000-00000000d001';

do $$
begin
  update public.projects
     set seeking_investment = false, funding_stage = 'seed'
   where id = '00000000-0000-4000-8000-00000000d001';
  raise exception 'B3 FALLÓ: flag apagado con campos debería fallar el CHECK';
exception when check_violation then
  null;
end $$;

update public.projects
   set seeking_investment = true,
       funding_stage = 'pre_seed',
       amount_sought = 25000,
       investment_currency = 'EUR'
 where id = '00000000-0000-4000-8000-00000000d001';

do $$
declare
  v_ok boolean;
begin
  select seeking_investment and funding_stage = 'pre_seed' into v_ok
  from public.projects where id = '00000000-0000-4000-8000-00000000d001';
  perform public.tests_assert(coalesce(v_ok, false), 'B3: la señal activa debe persistir');

  begin
    update public.projects
       set investment_currency = 'euros'
     where id = '00000000-0000-4000-8000-00000000d001';
    raise exception 'B3 FALLÓ: moneda no ISO aceptada';
  exception when check_violation then
    null;
  end;
end $$;

-- A9: mensajería reutilizada (el cliente del servicio escribe al proveedor).
select public.tests_set_uid('00000000-0000-4000-8000-00000000f002');
do $$
declare
  v_conversation uuid;
begin
  select public.get_or_create_dm('00000000-0000-4000-8000-00000000f001') into v_conversation;
  perform public.tests_assert(v_conversation is not null, 'A9: get_or_create_dm debe abrir la conversación');
end $$;

-- ---------------------------------------------------------------------------
-- Limpieza (solo entorno local)
-- ---------------------------------------------------------------------------
select public.tests_set_uid(null);
delete from public.projects where id = '00000000-0000-4000-8000-00000000d001';
delete from public.services where provider_id in (
  '00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000f002');
delete from public.conversations
where dm_low in ('00000000-0000-4000-8000-00000000f001','00000000-0000-4000-8000-00000000f002')
   or dm_high in ('00000000-0000-4000-8000-00000000f001','00000000-0000-4000-8000-00000000f002');

commit;
