-- ============================================================================
-- FASE 12 — Tests de hardening de seguridad (supabase/tests)
-- ============================================================================
-- Validan la migración 20260826000000_fase12_security_hardening.sql.
-- EJECUTAR SOLO EN ENTORNO DE DESARROLLO / LOCAL (p. ej. `supabase start`).
-- NUNCA contra una base de datos de producción.
--
-- Todo corre dentro de una transacción que termina en ROLLBACK: no modifica
-- esquema ni datos de forma persistente. Emplea asserts de catálogo y pruebas
-- de comportamiento de RPC/RLS con claims de JWT simulados. Los cambios de rol
-- (set role anon/authenticated) se ejecutan con EXECUTE y se restauran antes
-- de escribir resultados, para no depender de permisos sobre tablas temp.
-- ============================================================================

\set ON_ERROR_STOP off

begin;

-- ---------------------------------------------------------------------------
-- Utilidades: ok/raises + registro de fallos en tabla temp
-- ---------------------------------------------------------------------------
create or replace function public.t12_ok(sql text) returns boolean
language plpgsql set search_path = '' as $$
begin
  execute sql;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.t12_raises(sql text) returns boolean
language plpgsql set search_path = '' as $$
begin
  execute sql;
  return false;
exception when others then
  return true;
end;
$$;

grant execute on function public.t12_ok(text) to anon, authenticated;
grant execute on function public.t12_raises(text) to anon, authenticated;

create temp table pg_temp.t12_failures (id serial, msg text);

-- Helper de registro (se invoca SIEMPRE como postgres, tras restaurar rol)
create or replace function public.t12_fail(p_msg text) returns void
language sql set search_path = '' as $$
  insert into pg_temp.t12_failures (msg) values (p_msg)
$$;

-- ---------------------------------------------------------------------------
-- 1. ACL de tablas (mínimo privilegio)
-- ---------------------------------------------------------------------------
do $$
begin
  -- profiles: columnas públicas sí, privadas no
  if not has_column_privilege('anon', 'public.profiles', 'id', 'select') then
    perform public.t12_fail('profiles.id no legible por anon');
  end if;
  if not has_column_privilege('anon', 'public.profiles', 'username', 'select') then
    perform public.t12_fail('profiles.username no legible por anon');
  end if;
  if has_column_privilege('anon', 'public.profiles', 'contact_email', 'select') then
    perform public.t12_fail('profiles.contact_email legible por anon');
  end if;
  if has_column_privilege('anon', 'public.profiles', 'timezone', 'select') then
    perform public.t12_fail('profiles.timezone legible por anon');
  end if;
  if has_column_privilege('anon', 'public.profiles', 'search_text', 'select') then
    perform public.t12_fail('profiles.search_text legible por anon');
  end if;
  if has_column_privilege('anon', 'public.profiles', 'onboarding_completed', 'select') then
    perform public.t12_fail('profiles.onboarding_completed legible por anon');
  end if;
  -- authenticated puede actualizar sus datos privados pero NO leer los de todos
  if has_column_privilege('authenticated', 'public.profiles', 'contact_email', 'select') then
    perform public.t12_fail('profiles.contact_email legible por cualquier authenticated');
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'contact_email', 'update') then
    perform public.t12_fail('profiles.contact_email no editable por authenticated (dueño)');
  end if;

  -- Tablas sin lectura pública: anon no debe poder SELECT
  if has_table_privilege('anon', 'public.applications', 'SELECT') then
    perform public.t12_fail('applications legible por anon');
  end if;
  if has_table_privilege('anon', 'public.conversations', 'SELECT') then
    perform public.t12_fail('conversations legible por anon');
  end if;
  if has_table_privilege('anon', 'public.notifications', 'SELECT') then
    perform public.t12_fail('notifications legible por anon');
  end if;
  if has_table_privilege('anon', 'public.post_reactions', 'SELECT') then
    perform public.t12_fail('post_reactions legible por anon');
  end if;
  if has_table_privilege('anon', 'public.profile_blocks', 'SELECT') then
    perform public.t12_fail('profile_blocks legible por anon');
  end if;
  if has_table_privilege('anon', 'public.rate_limits', 'SELECT') then
    perform public.t12_fail('rate_limits legible por anon');
  end if;
  if has_table_privilege('anon', 'public.rate_limits', 'INSERT') then
    perform public.t12_fail('rate_limits insertable por anon');
  end if;
  if has_table_privilege('authenticated', 'public.rate_limits', 'SELECT') then
    perform public.t12_fail('rate_limits legible por authenticated');
  end if;

  -- Tablas de referencia: SOLO lectura
  if has_table_privilege('anon', 'public.skills', 'INSERT') then
    perform public.t12_fail('skills insertable por anon');
  end if;
  if has_table_privilege('anon', 'public.skills', 'DELETE') then
    perform public.t12_fail('skills borrable por anon');
  end if;

  -- Grants residuales de TRUNCATE/REFERENCES/TRIGGER eliminados
  if has_table_privilege('anon', 'public.projects', 'TRUNCATE') then
    perform public.t12_fail('projects TRUNCATE para anon');
  end if;
  if has_table_privilege('authenticated', 'public.projects', 'TRIGGER') then
    perform public.t12_fail('projects TRIGGER para authenticated');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. ACL de funciones: triggers retirados, RPC concedidas a quien toca
-- ---------------------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE') then
    perform public.t12_fail('handle_new_user ejecutable por anon');
  end if;
  if has_function_privilege('authenticated', 'public.handle_updated_at()', 'EXECUTE') then
    perform public.t12_fail('handle_updated_at ejecutable por authenticated');
  end if;
  if has_function_privilege('anon', 'public.normalize_profile_username()', 'EXECUTE') then
    perform public.t12_fail('normalize_profile_username ejecutable por anon');
  end if;
  if has_function_privilege('authenticated', 'public.posts_sync_from_video()', 'EXECUTE') then
    perform public.t12_fail('posts_sync_from_video ejecutable por authenticated');
  end if;

  -- get_own_profile: SOLO authenticated
  if has_function_privilege('anon', 'public.get_own_profile()', 'EXECUTE') then
    perform public.t12_fail('get_own_profile ejecutable por anon');
  end if;
  if not has_function_privilege('authenticated', 'public.get_own_profile()', 'EXECUTE') then
    perform public.t12_fail('get_own_profile no ejecutable por authenticated');
  end if;

  -- admin_resolve_report: SOLO authenticated (la RPC revalida rol admin)
  if has_function_privilege('anon', 'public.admin_resolve_report(uuid, text, text)', 'EXECUTE') then
    perform public.t12_fail('admin_resolve_report ejecutable por anon');
  end if;
  -- consume_rate_limit: anon + authenticated (flujo pre-login usa IP)
  if not has_function_privilege('anon', 'public.consume_rate_limit(text, text, integer, integer)', 'EXECUTE') then
    perform public.t12_fail('consume_rate_limit no ejecutable por anon');
  end if;
  if not has_function_privilege('authenticated', 'public.consume_rate_limit(text, text, integer, integer)', 'EXECUTE') then
    perform public.t12_fail('consume_rate_limit no ejecutable por authenticated');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. consume_rate_limit: límite, scoping y validación de parámetros
-- ---------------------------------------------------------------------------
do $$
declare
  r1 boolean; r2 boolean; r3 boolean; r4 boolean; rBad boolean;
begin
  r1 := public.consume_rate_limit('t12_scope', 'key_a', 2, 60);
  r2 := public.consume_rate_limit('t12_scope', 'key_a', 2, 60);
  r3 := public.consume_rate_limit('t12_scope', 'key_a', 2, 60);
  r4 := public.consume_rate_limit('t12_scope', 'key_b', 2, 60);
  rBad := public.consume_rate_limit('t12_scope', 'key_b', 0, 60);

  if not r1 then perform public.t12_fail('rate-limit: 1a llamada debe permitir'); end if;
  if not r2 then perform public.t12_fail('rate-limit: 2a llamada dentro del max debe permitir'); end if;
  if r3 then perform public.t12_fail('rate-limit: 3a llamada debe bloquear'); end if;
  if not r4 then perform public.t12_fail('rate-limit: límite debe ser por scope_key'); end if;
  if rBad then perform public.t12_fail('rate-limit: p_max inválido debe bloquear'); end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. get_own_profile: solo la fila propia y con su parte privada
-- ---------------------------------------------------------------------------
do $$
declare
  v_prof uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_as_owner text;
  v_as_other text;
begin
  insert into public.profiles (id, username, full_name, contact_email, timezone, onboarding_completed)
  values (v_prof, 't12_owner' || left(v_prof::text, 8), 'Owner T12', 'owner@example.com', 'Europe/Madrid', true);
  insert into public.profiles (id, username, full_name, contact_email)
  values (v_other, 't12_other' || left(v_other::text, 8), 'Other T12', 'other@example.com');

  -- como el propietario
  perform set_config('request.jwt.claim.sub', v_prof::text, true);
  execute 'set role authenticated';
  v_as_owner := public.t12_ok(
    'select id, contact_email from public.get_own_profile() where id = ''' || v_prof || ''''
  );
  execute 'reset role';

  -- como otro usuario: la RPC debe devolver vacío (fail-closed)
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  execute 'set role authenticated';
  v_as_other := public.t12_ok(
    'select 1 from public.get_own_profile() where id = ''' || v_prof || ''''
  );
  execute 'reset role';

  if not v_as_owner then
    perform public.t12_fail('get_own_profile no devolvió la fila propia con datos privados');
  end if;
  if v_as_other then
    perform public.t12_fail('get_own_profile filtró el perfil de otro usuario');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. content_reports: anon denegado, reporter permitido, admin resuelve
-- ---------------------------------------------------------------------------
do $$
declare
  v_reporter uuid := gen_random_uuid();
  v_target uuid := gen_random_uuid();
  v_report uuid;
  v_state text;
  v_anon_insert boolean;
  v_anon_read boolean;
  v_own_insert boolean;
  v_other_insert boolean;
  v_nonadmin_resolve boolean;
  v_admin_resolve boolean;
begin
  insert into public.profiles (id, username, full_name)
  values (v_reporter, 't12_rep' || left(v_reporter::text, 8), 'Reporter T12');

  -- anon: ni insertar ni leer
  perform set_config('request.jwt.claim.sub', v_reporter::text, true);
  execute 'set role anon';
  v_anon_insert := public.t12_raises(
    'insert into public.content_reports (reporter_id, target_type, target_id, reason)
     values (''' || v_reporter || ''', ''post'', ''' || v_target || ''', ''spam'')'
  );
  v_anon_read := public.t12_raises('select count(*) from public.content_reports');
  execute 'reset role';

  -- authenticated con sub propio: puede reportar
  execute 'set role authenticated';
  v_own_insert := public.t12_ok(
    'insert into public.content_reports (reporter_id, target_type, target_id, reason)
     values (''' || v_reporter || ''', ''post'', ''' || v_target || ''', ''spam'')'
  );
  select id into v_report
  from public.content_reports where reporter_id = v_reporter limit 1;
  execute 'reset role';

  if v_report is null then
    perform public.t12_fail('no se creó el reporte del reporter propio');
  end if;

  -- authenticated NO puede reportar "en nombre de otro"
  execute 'set role authenticated';
  v_other_insert := public.t12_raises(
    'insert into public.content_reports (reporter_id, target_type, target_id, reason)
     values (''' || gen_random_uuid() || ''', ''post'', ''' || v_target || ''', ''spam'')'
  );
  execute 'reset role';

  -- authenticated NO admin no puede resolver
  execute 'set role authenticated';
  v_nonadmin_resolve := public.t12_raises(
    'select public.admin_resolve_report(''' || v_report || ''', ''resolved'')'
  );
  execute 'reset role';

  -- admin sí puede resolver
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_reporter, 'app_metadata', json_build_object('role', 'admin'))::text,
    true
  );
  execute 'set role authenticated';
  v_admin_resolve := public.t12_ok(
    'select public.admin_resolve_report(''' || v_report || ''', ''resolved'')'
  );
  select status into v_state from public.content_reports where id = v_report;
  execute 'reset role';

  if not v_anon_insert then perform public.t12_fail('anon pudo insertar un reporte'); end if;
  if not v_anon_read then perform public.t12_fail('anon pudo leer content_reports'); end if;
  if not v_own_insert then perform public.t12_fail('authenticated no pudo reportar'); end if;
  if not v_other_insert then perform public.t12_fail('authenticated pudo reportar como otro usuario'); end if;
  if not v_nonadmin_resolve then perform public.t12_fail('usuario normal pudo resolver un reporte'); end if;
  if not v_admin_resolve then perform public.t12_fail('admin no pudo resolver el reporte'); end if;
  if v_state is distinct from 'resolved' then perform public.t12_fail('el reporte no quedó resuelto'); end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Búsquedas: el predicado bidireccional de bloqueos en las 4 nuevas
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname in ('search_projects', 'search_organizations', 'search_videos', 'search_opportunities')
    and prosrc like '%profile_blocks%';

  if v_count <> 4 then
    perform public.t12_fail('solo ' || v_count || '/4 search_* tienen el filtro de profile_blocks');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
  v_line text;
begin
  select count(*) into v_count from pg_temp.t12_failures;
  if v_count = 0 then
    raise notice '[FASE 12] TODOS LOS CHECKS OK';
  else
    raise warning '[FASE 12] % check(s) fallidos:', v_count;
    for v_line in select msg from pg_temp.t12_failures order by id loop
      raise warning '  - %', v_line;
    end loop;
  end if;
end;
$$;

-- Limpieza (se deshace con el ROLLBACK de todos modos)
drop function public.t12_ok(text);
drop function public.t12_raises(text);
drop function public.t12_fail(text);

rollback;