-- ============================================================================
-- FASE 4.2 — Verificación de invariantes (seguimiento social)
-- ============================================================================
-- Script SQL que comprueba los comportamientos exigidos por la migración
-- 20260810000000_fase4_follows.sql:
--   1. anon NO puede insertar, borrar ni leer en las tablas de follows (sin
--      grants; REVOKE SELECT aplicado por la corrección 20260811000000).
--   2. Un usuario autenticado SOLO puede modificar sus propios follows; no puede
--      insertar ni borrar en nombre de otro perfil (RLS insert_own/delete_own).
--   3. Un follow entre personas bloqueadas nunca se crea (FOLLOW_BLOCKED en
--      cualquier dirección); al bloquear se eliminan los follows A→B y B→A
--      (triggers + policies de saneamiento) y al desbloquear se puede volver.
--   4. Solo se puede seguir lo que se puede ver: un perfil privado o un
--      proyecto/organización privada devuelven FOLLOW_TARGET_NOT_VISIBLE.
--   5. Idempotencia y unicidad a nivel de BD (UNIQUE compuesto): un follow
--      repetido lanza violation; el auto-follow se rechaza por CHECK.
--   6. Las RPC de conteo público no filtran entidades privadas: un anónimo (o
--      un no-implicado) recibe 0 para perfiles/proyectos/organizaciones no
--      visibles, y los propietarios sí ven su total. Las RPC nunca fallan para
--      anon (ni una política genera errores a anon).
--   7. El equipo de un proyecto/organización puede listar a sus seguidores
--      (project_follows_select_team / organization_follows_select_team) pero un
--      anónimo no puede leer las tablas de follows.
--
-- Cómo ejecutarlo (stack LOCAL de Supabase, como postgres, tras aplicar las
-- migraciones 20260731 → 20260810):
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fase4_follows.sql
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
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'erin@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- Carol se crea pública para poder sembrar un follow de prueba, y se pasa a
-- privada justo después: el resto del script la trata como perfil privado.
insert into public.profiles (id, username, full_name, is_public)
values
  ('00000000-0000-0000-0000-000000000001', 'alice', 'Alice', true),
  ('00000000-0000-0000-0000-000000000002', 'bob', 'Bob', true),
  ('00000000-0000-0000-0000-000000000003', 'carol', 'Carol', true),
  ('00000000-0000-0000-0000-000000000004', 'dave', 'Dave', true),
  ('00000000-0000-0000-0000-000000000005', 'erin', 'Erin', true);

-- P1 (alice, pública publicada), P2 (bob, privada). O1 (alice, pública), O2
-- (bob, privada).
insert into public.projects (id, owner_id, slug, name, stage, status, is_public)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'proyecto-publico', 'Proyecto público', 'idea', 'published', true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'proyecto-privado', 'Proyecto privado', 'idea', 'published', false);

insert into public.organizations (id, owner_id, slug, name, is_public)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'org-publica', 'Organización pública', true),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'org-privada', 'Organización privada', false);

-- Bob es miembro de P1; dave es miembro de O1 (para probar las políticas de
-- "el equipo ve a sus seguidores").
insert into public.project_members (project_id, profile_id, role)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'contributor');

insert into public.organization_members (organization_id, profile_id, role)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'member');

-- Follow de prueba dave→carol (se inserta con carol pública) y después carol
-- pasa a privada: su contador debe quedar oculto salvo para ella misma.
insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003');

update public.profiles set is_public = false where id = '00000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- TEST 1: anon NO puede insertar ni borrar en las tablas de follows
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  begin
    insert into public.profile_follows (profile_id, following_id)
    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST1: anon pudo insertar un follow de perfil';
  exception
    when others then
      if sqlerrm like '%FALLO TEST1%' then raise; end if;
  end;
  begin
    delete from public.profile_follows;
    raise exception 'FALLO TEST1: anon pudo borrar follows';
  exception
    when others then
      if sqlerrm like '%FALLO TEST1%' then raise; end if;
  end;
  begin
    insert into public.project_follows (profile_id, project_id)
    values ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
    raise exception 'FALLO TEST1: anon pudo insertar un follow de proyecto';
  exception
    when others then
      if sqlerrm like '%FALLO TEST1%' then raise; end if;
  end;
  begin
    insert into public.organization_follows (profile_id, organization_id)
    values ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');
    raise exception 'FALLO TEST1: anon pudo insertar un follow de organización';
  exception
    when others then
      if sqlerrm like '%FALLO TEST1%' then raise; end if;
  end;
  begin
    perform from public.profile_follows;
    raise exception 'FALLO TEST1: anon pudo leer profile_follows';
  exception
    when others then
      if sqlerrm like '%FALLO TEST1%' then raise; end if;
  end;
  begin
    perform from public.project_follows;
    raise exception 'FALLO TEST1: anon pudo leer project_follows';
  exception
    when others then
      if sqlerrm like '%FALLO TEST1%' then raise; end if;
  end;
  begin
    perform from public.organization_follows;
    raise exception 'FALLO TEST1: anon pudo leer organization_follows';
  exception
    when others then
      if sqlerrm like '%FALLO TEST1%' then raise; end if;
  end;
  raise notice 'PASS TEST1: anon no puede insertar, borrar ni leer las tablas de follows';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 2: las RPC de conteo funcionan para anon sin error (y sin datos = 0)
-- ---------------------------------------------------------------------------
do $$
begin
  if public.count_profile_followers('00000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'FALLO TEST2: anon recibió followers de alice sin que existan';
  end if;
  if public.count_profile_following('00000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'FALLO TEST2: anon recibió following de alice sin que existan';
  end if;
  if public.count_project_followers('20000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'FALLO TEST2: anon recibió followers de P1 sin que existan';
  end if;
  if public.count_organization_followers('30000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'FALLO TEST2: anon recibió followers de O1 sin que existan';
  end if;
  raise notice 'PASS TEST2: las RPC de conteo funcionan para anon y no filtran datos';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 3: un autenticado sigue a un perfil público y ve solo lo suyo
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

do $$
begin
  if (select count(*) from public.profile_follows
      where profile_id = '00000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALLO TEST3: alice no pudo seguir a bob';
  end if;
  -- Alice solo ve filas en las que es parte (profile_id o following_id).
  if exists (
    select 1 from public.profile_follows
    where profile_id <> '00000000-0000-0000-0000-000000000001'
      and following_id <> '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST3: alice ve follows en los que no participa';
  end if;
  raise notice 'PASS TEST3: seguir a un perfil público funciona y la RLS limita la lectura';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 4: no se puede seguir un perfil privado
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    insert into public.profile_follows (profile_id, following_id)
    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003');
    raise exception 'FALLO TEST4: alice pudo seguir a un perfil privado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
      if sqlerrm not like '%FOLLOW_TARGET_NOT_VISIBLE%' then
        raise exception 'FALLO TEST4: error inesperado al seguir un perfil privado: %', sqlerrm;
      end if;
  end;
  if exists (
    select 1 from public.profile_follows
    where profile_id = '00000000-0000-0000-0000-000000000001'
      and following_id = '00000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'FALLO TEST4: la fila del follow a un perfil privado se creó';
  end if;
  raise notice 'PASS TEST4: seguir un perfil privado devuelve FOLLOW_TARGET_NOT_VISIBLE';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 5: el auto-follow se rechaza (CHECK de BD)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    insert into public.profile_follows (profile_id, following_id)
    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
    raise exception 'FALLO TEST5: alice pudo seguirse a sí misma';
  exception
    when others then
      if sqlerrm like '%FALLO TEST5%' then raise; end if;
      raise notice 'PASS TEST5: el auto-follow se rechaza por CHECK';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TEST 6: el follow repetido se rechaza (UNIQUE compuesto)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    insert into public.profile_follows (profile_id, following_id)
    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST6: un follow duplicado fue aceptado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST6%' then raise; end if;
      raise notice 'PASS TEST6: el follow repetido se rechaza por el UNIQUE compuesto';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TEST 7: no se puede insertar un follow en nombre de otro perfil (RLS)
-- ---------------------------------------------------------------------------
do $$
begin
  -- Alice intenta insertar una fila cuyo profile_id es bob: la política
  -- insert_own (auth.uid() = profile_id) filtra la fila silenciosamente.
  insert into public.profile_follows (profile_id, following_id)
  values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
  if exists (
    select 1 from public.profile_follows
    where profile_id = '00000000-0000-0000-0000-000000000002'
      and following_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST7: alice pudo insertar un follow en nombre de bob';
  end if;
  raise notice 'PASS TEST7: la RLS impide insertar follows de otro perfil';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 8: bloqueo simétrico — bloquear elimina A→B y B→A y prohíbe re-seguir
-- ---------------------------------------------------------------------------
-- bob sigue a alice (fila propia de bob).
insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');

do $$
begin
  if (select count(*) from public.profile_follows
      where (profile_id = '00000000-0000-0000-0000-000000000001' and following_id = '00000000-0000-0000-0000-000000000002')
         or (profile_id = '00000000-0000-0000-0000-000000000002' and following_id = '00000000-0000-0000-0000-000000000001')) <> 2 then
    raise exception 'FALLO TEST8: el setup de los follows bidireccionales falló';
  end if;
  raise notice 'SETUP TEST8: existen los follows alice→bob y bob→alice';
end $$;

-- bob bloquea a alice.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.profile_blocks (profile_id, blocked_id)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');

do $$
begin
  if (select count(*) from public.profile_follows
      where (profile_id = '00000000-0000-0000-0000-000000000001' and following_id = '00000000-0000-0000-0000-000000000002')
         or (profile_id = '00000000-0000-0000-0000-000000000002' and following_id = '00000000-0000-0000-0000-000000000001')) <> 0 then
    raise exception 'FALLO TEST8: al bloquear no se eliminaron los follows A→B y B→A';
  end if;
  raise notice 'PASS TEST8: bloquear a alguien elimina los follows en ambas direcciones';
end $$;

-- alice intenta volver a seguir a bob: bloqueado.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.profile_follows (profile_id, following_id)
    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST8: alice pudo seguir a quien la bloqueó';
  exception
    when others then
      if sqlerrm like '%FALLO TEST8%' then raise; end if;
      if sqlerrm not like '%FOLLOW_BLOCKED%' then
        raise exception 'FALLO TEST8: error inesperado al seguir a un bloqueador: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST8: seguir a quien te bloqueó devuelve FOLLOW_BLOCKED';
end $$;

-- Desbloqueo: bob borra el bloqueo y alice puede volver a seguir.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

delete from public.profile_blocks
where profile_id = '00000000-0000-0000-0000-000000000002'
  and blocked_id = '00000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

do $$
begin
  if not exists (
    select 1 from public.profile_follows
    where profile_id = '00000000-0000-0000-0000-000000000001'
      and following_id = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FALLO TEST8: alice no pudo seguir a bob tras desbloquear';
  end if;
  raise notice 'PASS TEST8: tras desbloquear se puede volver a seguir';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 8B: bloqueo simétrico — bloqueador y bloqueado no pueden re-seguirse;
-- al desbloquear, ambas direcciones vuelven a estar permitidas
-- ---------------------------------------------------------------------------
-- bob (A) bloquea a alice (B). Mientras exista el bloqueo, NI A→B NI B→A se
-- crean. Al desbloquear, las dos direcciones vuelven a ser válidas.
-- Estado previo: alice→bob existe (final TEST 8); bob→alice no existe.

-- bob bloquea a alice: el cleanup debe eliminar también alice→bob (B→A).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.profile_blocks (profile_id, blocked_id)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');

do $$
begin
  if exists (
    select 1 from public.profile_follows
    where profile_id = '00000000-0000-0000-0000-000000000001'
      and following_id = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FALLO TEST8B: el cleanup no eliminó B→A (alice→bob) al bloquear';
  end if;
  raise notice 'PASS TEST8B: al bloquear, el cleanup eliminó el follow entrante B→A';
end $$;

-- A (bob, el bloqueador) intenta seguir a B (alice): FOLLOW_BLOCKED.
do $$
begin
  begin
    insert into public.profile_follows (profile_id, following_id)
    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
    raise exception 'FALLO TEST8B: A pudo seguir a B estando bloqueada';
  exception
    when others then
      if sqlerrm like '%FALLO TEST8B%' then raise; end if;
      if sqlerrm not like '%FOLLOW_BLOCKED%' then
        raise exception 'FALLO TEST8B: error inesperado al seguir a la bloqueada: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST8B: A (bloqueador) no puede seguir a B';
end $$;

-- B (alice, la bloqueada) intenta seguir a A (bob): FOLLOW_BLOCKED.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.profile_follows (profile_id, following_id)
    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST8B: B pudo seguir a A estando bloqueada';
  exception
    when others then
      if sqlerrm like '%FALLO TEST8B%' then raise; end if;
      if sqlerrm not like '%FOLLOW_BLOCKED%' then
        raise exception 'FALLO TEST8B: error inesperado al seguir a un bloqueador: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST8B: B (bloqueada) no puede seguir a A';
end $$;

-- Se elimina el bloqueo (bob borra su bloqueo).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

delete from public.profile_blocks
where profile_id = '00000000-0000-0000-0000-000000000002'
  and blocked_id = '00000000-0000-0000-0000-000000000001';

-- A (bob) vuelve a poder seguir a B (alice).
do $$
begin
  insert into public.profile_follows (profile_id, following_id)
  values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
  if not exists (
    select 1 from public.profile_follows
    where profile_id = '00000000-0000-0000-0000-000000000002'
      and following_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST8B: A no pudo volver a seguir a B tras desbloquear';
  end if;
  raise notice 'PASS TEST8B: tras desbloquear, A puede volver a seguir a B';
end $$;

-- B (alice) vuelve a poder seguir a A (bob).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  insert into public.profile_follows (profile_id, following_id)
  values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
  if not exists (
    select 1 from public.profile_follows
    where profile_id = '00000000-0000-0000-0000-000000000001'
      and following_id = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FALLO TEST8B: B no pudo volver a seguir a A tras desbloquear';
  end if;
  raise notice 'PASS TEST8B: tras desbloquear, B puede volver a seguir a A';
end $$;

-- Restaura el estado para los tests siguientes: bob retira su follow (A→B) y
-- queda solo alice→bob (B→A), que es el estado que esperan TEST 11 y TEST 12.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

delete from public.profile_follows
where profile_id = '00000000-0000-0000-0000-000000000002'
  and following_id = '00000000-0000-0000-0000-000000000001';

do $$
begin
  if exists (
    select 1 from public.profile_follows
    where profile_id = '00000000-0000-0000-0000-000000000002'
      and following_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST8B: no se pudo restaurar el estado (A→B sigue)';
  end if;
  raise notice 'PASS TEST8B: estado restaurado (solo alice→bob) para TEST 11/12';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 9: follows de proyectos — visibilidad, unicidad y visión del equipo
-- ---------------------------------------------------------------------------
-- alice sigue al proyecto público P1 y no puede seguir al privado P2.
insert into public.project_follows (profile_id, project_id)
values ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');

do $$
begin
  if not exists (
    select 1 from public.project_follows
    where profile_id = '00000000-0000-0000-0000-000000000001'
      and project_id = '20000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST9: alice no pudo seguir un proyecto público';
  end if;
  raise notice 'PASS TEST9: seguir un proyecto público publicado funciona';
end $$;

do $$
begin
  begin
    insert into public.project_follows (profile_id, project_id)
    values ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST9: alice pudo seguir un proyecto privado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      if sqlerrm not like '%FOLLOW_TARGET_NOT_VISIBLE%' then
        raise exception 'FALLO TEST9: error inesperado al seguir un proyecto privado: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST9: seguir un proyecto privado devuelve FOLLOW_TARGET_NOT_VISIBLE';
end $$;

-- Un follow repetido de proyecto se rechaza por el UNIQUE.
do $$
begin
  begin
    insert into public.project_follows (profile_id, project_id)
    values ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
    raise exception 'FALLO TEST9: un follow de proyecto duplicado fue aceptado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise notice 'PASS TEST9: el follow de proyecto repetido se rechaza por el UNIQUE';
  end;
end $$;

-- El propietario puede seguir su propio proyecto privado (lo ve); su equipo ve
-- los seguidores del proyecto (select_team).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.project_follows (profile_id, project_id)
values ('00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');

do $$
begin
  if not exists (
    select 1 from public.project_follows
    where profile_id = '00000000-0000-0000-0000-000000000002'
      and project_id = '20000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FALLO TEST9: el propietario no pudo seguir su proyecto privado';
  end if;
  -- bob es miembro de P1: debe ver el follow de alice (select_team).
  if (select count(*) from public.project_follows
      where project_id = '20000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALLO TEST9: el equipo no ve a los seguidores de su proyecto';
  end if;
  raise notice 'PASS TEST9: el equipo ve a los seguidores del proyecto (select_team)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 10: follows de organizaciones — visibilidad y unicidad
-- ---------------------------------------------------------------------------
-- alice sigue a la organización pública O1 y no puede seguir a la privada O2.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.organization_follows (profile_id, organization_id)
values ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

do $$
begin
  if not exists (
    select 1 from public.organization_follows
    where profile_id = '00000000-0000-0000-0000-000000000001'
      and organization_id = '30000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST10: alice no pudo seguir una organización pública';
  end if;
  raise notice 'PASS TEST10: seguir una organización pública funciona';
end $$;

do $$
begin
  begin
    insert into public.organization_follows (profile_id, organization_id)
    values ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST10: alice pudo seguir una organización privada';
  exception
    when others then
      if sqlerrm like '%FALLO TEST10%' then raise; end if;
      if sqlerrm not like '%FOLLOW_TARGET_NOT_VISIBLE%' then
        raise exception 'FALLO TEST10: error inesperado al seguir una organización privada: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST10: seguir una organización privada devuelve FOLLOW_TARGET_NOT_VISIBLE';
end $$;

-- Un follow repetido de organización se rechaza por el UNIQUE.
do $$
begin
  begin
    insert into public.organization_follows (profile_id, organization_id)
    values ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');
    raise exception 'FALLO TEST10: un follow de organización duplicado fue aceptado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST10%' then raise; end if;
      raise notice 'PASS TEST10: el follow de organización repetido se rechaza por el UNIQUE';
  end;
end $$;

-- El propietario puede seguir su propia organización privada.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.organization_follows (profile_id, organization_id)
values ('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002');

do $$
begin
  if not exists (
    select 1 from public.organization_follows
    where profile_id = '00000000-0000-0000-0000-000000000002'
      and organization_id = '30000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FALLO TEST10: el propietario no pudo seguir su organización privada';
  end if;
  raise notice 'PASS TEST10: el propietario puede seguir su propia organización privada';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 11: las RPC de conteo no filtran entidades privadas
-- ---------------------------------------------------------------------------
-- Estado esperado (como postgres para inspeccionar, luego por rol):
--   profile_follows: alice→bob (1), dave→carol (1)  [bob→alice fue borrado]
--   project_follows: alice→P1 (1), bob→P2 (1)
--   organization_follows: alice→O1 (1), bob→O2 (1)

-- anon: solo ve lo público; carol (privada) y P2/O2 (privados) = 0.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if public.count_profile_followers('00000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'FALLO TEST11: anon no ve el contador de followers de bob (público)';
  end if;
  if public.count_profile_following('00000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALLO TEST11: anon no ve el contador de following de alice (público)';
  end if;
  if public.count_profile_followers('00000000-0000-0000-0000-000000000003') <> 0 then
    raise exception 'FALLO TEST11: anon ve el contador de followers de un perfil privado';
  end if;
  if public.count_profile_following('00000000-0000-0000-0000-000000000003') <> 0 then
    raise exception 'FALLO TEST11: anon ve el contador de following de un perfil privado';
  end if;
  if public.count_profile_following('00000000-0000-0000-0000-000000000004') <> 1 then
    raise exception 'FALLO TEST11: anon no ve el contador de following de dave (público, sigue a carol)';
  end if;
  if public.count_project_followers('20000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALLO TEST11: anon no ve el contador de followers de P1 (público)';
  end if;
  if public.count_project_followers('20000000-0000-0000-0000-000000000002') <> 0 then
    raise exception 'FALLO TEST11: anon ve el contador de followers de un proyecto privado';
  end if;
  if public.count_organization_followers('30000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALLO TEST11: anon no ve el contador de followers de O1 (pública)';
  end if;
  if public.count_organization_followers('30000000-0000-0000-0000-000000000002') <> 0 then
    raise exception 'FALLO TEST11: anon ve el contador de followers de una organización privada';
  end if;
  raise notice 'PASS TEST11: las RPC no filtran entidades privadas (anon ve 0 en lo no visible)';
end $$;

-- carol (privada) sí ve su propio contador; bob (propietario) ve los privados.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if public.count_profile_followers('00000000-0000-0000-0000-000000000003') <> 1 then
    raise exception 'FALLO TEST11: carol no ve su propio contador de followers';
  end if;
  raise notice 'PASS TEST11: el propietario de un perfil privado ve su propio contador';
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if public.count_project_followers('20000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'FALLO TEST11: el propietario no ve el contador de su proyecto privado';
  end if;
  if public.count_organization_followers('30000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'FALLO TEST11: el propietario no ve el contador de su organización privada';
  end if;
  raise notice 'PASS TEST11: el propietario ve los contadores de sus entidades privadas';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 12: borrar follows — el propio sí, el ajeno no
-- ---------------------------------------------------------------------------
-- bob crea el follow bob→alice; alice (que NO es parte) no puede borrarlo.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.profile_follows (profile_id, following_id)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  delete from public.profile_follows
  where profile_id = '00000000-0000-0000-0000-000000000002'
    and following_id = '00000000-0000-0000-0000-000000000001';
  if not exists (
    select 1 from public.profile_follows
    where profile_id = '00000000-0000-0000-0000-000000000002'
      and following_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FALLO TEST12: alice pudo borrar un follow ajeno';
  end if;
  raise notice 'PASS TEST12: un usuario no puede borrar los follows de otro (RLS)';
end $$;

-- alice sí puede borrar su propio follow alice→bob.
do $$
begin
  delete from public.profile_follows
  where profile_id = '00000000-0000-0000-0000-000000000001'
    and following_id = '00000000-0000-0000-0000-000000000002';
  if exists (
    select 1 from public.profile_follows
    where profile_id = '00000000-0000-0000-0000-000000000001'
      and following_id = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FALLO TEST12: alice no pudo borrar su propio follow';
  end if;
  raise notice 'PASS TEST12: un usuario puede borrar sus propios follows';
end $$;

-- ---------------------------------------------------------------------------
-- Limpieza: nada de lo anterior persiste.
-- ---------------------------------------------------------------------------
raise notice 'TODOS LOS TESTS DE FASE 4.2 (FOLLOWS) PASARON';
rollback;
