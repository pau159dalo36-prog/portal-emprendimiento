-- FASE 4.2 — Seguimiento (migración NO destructiva)
-- ============================================================================
-- Objetivo: activar el seguimiento social entre perfiles, proyectos y
-- organizaciones reutilizando las tablas `profile_follows`/`profile_blocks`
-- existentes (FASE 1) y añadiendo `project_follows`/`organization_follows`.
--
-- Principios de diseño:
--  * `profile_follows` y `profile_blocks` YA EXISTEN: no se recrean ni se
--    altera su esquema. Se añaden únicamente dos políticas nuevas necesarias
--    para el saneamiento simétrico de bloqueos.
--  * Las tablas nuevas siguen el patrón de FASE 1 (UNIQUE, CHECK de auto-follow
--    solo donde aplica, índices por FK, RLS obligatoria, grants explícitos).
--  * Solo se puede seguir lo que se puede ver: un trigger BEFORE INSERT sobre
--    cada tabla valida la visibilidad del objetivo mediante las políticas RLS
--    existentes (subquery bajo RLS), sin duplicar lógica de visibilidad.
--  * Saneamiento de bloqueos sin SECURITY DEFINER nuevo: el bloqueado pasa a
--    ver sus bloqueos (`profile_blocks_select_blocked`) y el bloqueador puede
--    retirar el follow entrante (`profile_follows_delete_blocked`); dos
--    triggers invoker (`profile_follows_check` y `profile_blocks_cleanup_follows`)
--    garantizan que A bloquea a B ⇒ se eliminan A→B y B→A y que un follow entre
--    personas bloqueadas nunca se crea. Al desbloquear, se puede volver a seguir.
--  * Los contadores públicos se sirven con RPCs `count_*_followers/following`
--    SECURITY DEFINER que devuelven SOLO totales (nunca identidades), única
--    excepción a la regla de no introducir SECURITY DEFINER (necesaria para
--    contar sin filtrar la privacidad de quién sigue a quién). El patrón es el
--    mismo que `can_access_video_storage`. Además condicionan el conteo a que la
--    ENTIDAD SEGUIDA sea visible para el llamante (perfil público/propio;
--    proyecto publicado o del que se es miembro; organización pública o de la
--    que se es miembro): nunca son un vector para sondear IDs privados.
--  * Las políticas que llaman a helpers SECURITY DEFINER de membresía
--    (`project_follows_select_team`/`organization_follows_select_team`) llevan
--    `to authenticated` para evitar el bug de `videos_select_admin` (una
--    política evaluada por anon que invoca una función sin EXECUTE para anon).
--  * Sin políticas ni grants de UPDATE/DELETE sobre los follows ajenos (salvo
--    la retirada simétrica por bloqueo) ni de anon sobre las tablas.
--  * Fail-closed: cualquier insert rechazado no deja estados intermedios.

begin;

-- ============================================================================
-- 1. Tablas nuevas: `project_follows` y `organization_follows`
-- ============================================================================
create table public.project_follows (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, project_id)
);

create table public.organization_follows (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, organization_id)
);

-- Índices
create index if not exists project_follows_profile_id_idx on public.project_follows (profile_id);
create index if not exists project_follows_project_id_idx on public.project_follows (project_id);
create index if not exists organization_follows_profile_id_idx on public.organization_follows (profile_id);
create index if not exists organization_follows_organization_id_idx on public.organization_follows (organization_id);

-- ============================================================================
-- 2. Funciones de trigger (invoker, sin SECURITY DEFINER)
-- ============================================================================

-- Impide seguir a quien te ha bloqueado (en cualquier dirección) y exige que el
-- objetivo sea visible para quien inserta (las subconsultas corren bajo RLS:
-- solo se ve lo que el usuario puede ver). El CHECK profile_follows_self_check
-- ya impide seguirse a uno mismo.
create or replace function public.profile_follows_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profile_blocks pb
    where (pb.profile_id = new.profile_id and pb.blocked_id = new.following_id)
       or (pb.profile_id = new.following_id and pb.blocked_id = new.profile_id)
  ) then
    raise exception 'FOLLOW_BLOCKED';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.following_id and p.is_public = true
  ) then
    raise exception 'FOLLOW_TARGET_NOT_VISIBLE';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_follows_check_trigger on public.profile_follows;
create trigger profile_follows_check_trigger
  before insert on public.profile_follows
  for each row execute function public.profile_follows_check();

-- Los follows de proyectos/organizaciones solo exigen visibilidad del objetivo
-- (bajo RLS). No aplican bloqueos entre perfiles (el saneamiento por bloqueo
-- queda acotado al seguimiento entre perfiles, según la especificación).
create or replace function public.project_follows_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.projects p where p.id = new.project_id
  ) then
    raise exception 'FOLLOW_TARGET_NOT_VISIBLE';
  end if;
  return new;
end;
$$;

drop trigger if exists project_follows_check_trigger on public.project_follows;
create trigger project_follows_check_trigger
  before insert on public.project_follows
  for each row execute function public.project_follows_check();

create or replace function public.organization_follows_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organizations o where o.id = new.organization_id
  ) then
    raise exception 'FOLLOW_TARGET_NOT_VISIBLE';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_follows_check_trigger on public.organization_follows;
create trigger organization_follows_check_trigger
  before insert on public.organization_follows
  for each row execute function public.organization_follows_check();

-- Al bloquear (A bloquea a B) se eliminan los follows A→B y B→A. Corre como
-- invoker (el bloqueador): la política `profile_follows_delete_own` cubre el
-- follow saliente y `profile_follows_delete_blocked` el entrante. Sin
-- SECURITY DEFINER.
create or replace function public.profile_blocks_cleanup_follows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.profile_follows
  where (profile_id = new.profile_id and following_id = new.blocked_id)
     or (profile_id = new.blocked_id and following_id = new.profile_id);
  return new;
end;
$$;

drop trigger if exists profile_blocks_cleanup_follows_trigger on public.profile_blocks;
create trigger profile_blocks_cleanup_follows_trigger
  after insert on public.profile_blocks
  for each row execute function public.profile_blocks_cleanup_follows();

-- ============================================================================
-- 3. Contadores públicos (RPCs SECURITY DEFINER de SOLO conteos)
-- ============================================================================
-- Devuelven únicamente totales; jamás identidades. Necesarias para exponer los
-- contadores en las páginas públicas sin romper la privacidad de las tablas de
-- follows (cuyo SELECT es privado por RLS). Mismo patrón que
-- `can_access_video_storage`.
--
-- IMPORTANTE (privacidad, requisito 6): aunque corren como SECURITY DEFINER
-- (omiten RLS), el conteo se condiciona a que la ENTIDAD SEGUIDA sea visible
-- para el llamante. Una RPC de conteo nunca es un vector para sondear IDs de
-- entidades privadas: un anónimo que conozca (o adivine) el UUID de un perfil/
-- proyecto/organización no público recibe 0, no el total real.
create or replace function public.count_profile_followers(p_profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.profile_follows f
  where f.following_id = p_profile_id
    and exists (
      select 1 from public.profiles p
      where p.id = p_profile_id
        and (p.is_public = true or p.id = auth.uid())
    );
$$;

create or replace function public.count_profile_following(p_profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.profile_follows f
  where f.profile_id = p_profile_id
    and exists (
      select 1 from public.profiles p
      where p.id = p_profile_id
        and (p.is_public = true or p.id = auth.uid())
    );
$$;

create or replace function public.count_project_followers(p_project_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.project_follows f
  where f.project_id = p_project_id
    and exists (
      select 1 from public.projects pr
      where pr.id = p_project_id
        and (
          (pr.is_public = true and pr.status = 'published')
          or pr.owner_id = auth.uid()
          or public.is_project_member(pr.id)
        )
    );
$$;

create or replace function public.count_organization_followers(p_organization_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.organization_follows f
  where f.organization_id = p_organization_id
    and exists (
      select 1 from public.organizations o
      where o.id = p_organization_id
        and (
          o.is_public = true
          or o.owner_id = auth.uid()
          or public.is_organization_member(o.id)
        )
    );
$$;

-- ============================================================================
-- 4. Row Level Security
-- ============================================================================
alter table public.project_follows enable row level security;
alter table public.organization_follows enable row level security;

-- project_follows: cada perfil ve SUS follows; el equipo del proyecto ve a sus
-- seguidores. Insert/delete propios. Sin UPDATE.
drop policy if exists "project_follows_select_own" on public.project_follows;
create policy "project_follows_select_own"
  on public.project_follows for select
  using (auth.uid() = profile_id);

drop policy if exists "project_follows_select_team" on public.project_follows;
create policy "project_follows_select_team"
  on public.project_follows for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "project_follows_insert_own" on public.project_follows;
create policy "project_follows_insert_own"
  on public.project_follows for insert
  with check (auth.uid() = profile_id);

drop policy if exists "project_follows_delete_own" on public.project_follows;
create policy "project_follows_delete_own"
  on public.project_follows for delete
  using (auth.uid() = profile_id);

-- organization_follows: análogo.
drop policy if exists "organization_follows_select_own" on public.organization_follows;
create policy "organization_follows_select_own"
  on public.organization_follows for select
  using (auth.uid() = profile_id);

drop policy if exists "organization_follows_select_team" on public.organization_follows;
create policy "organization_follows_select_team"
  on public.organization_follows for select
  to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists "organization_follows_insert_own" on public.organization_follows;
create policy "organization_follows_insert_own"
  on public.organization_follows for insert
  with check (auth.uid() = profile_id);

drop policy if exists "organization_follows_delete_own" on public.organization_follows;
create policy "organization_follows_delete_own"
  on public.organization_follows for delete
  using (auth.uid() = profile_id);

-- ============================================================================
-- 5. Ajustes de RLS existente (mínimos) para el saneamiento simétrico
-- ============================================================================

-- El bloqueado puede ver que lo está (necesario para el check simétrico del
-- trigger `profile_follows_check` y para saber cuándo puede volver a seguir).
drop policy if exists "profile_blocks_select_blocked" on public.profile_blocks;
create policy "profile_blocks_select_blocked"
  on public.profile_blocks for select
  to authenticated
  using (auth.uid() = blocked_id);

-- El bloqueador puede retirar el follow entrante de la persona bloqueada
-- (usado por el trigger `profile_blocks_cleanup_follows`).
drop policy if exists "profile_follows_delete_blocked" on public.profile_follows;
create policy "profile_follows_delete_blocked"
  on public.profile_follows for delete
  to authenticated
  using (
    auth.uid() = following_id
    and exists (
      select 1 from public.profile_blocks pb
      where pb.profile_id = auth.uid() and pb.blocked_id = profile_follows.profile_id
    )
  );

-- ============================================================================
-- 6. Permisos mínimos (auto_expose_new_tables desactivado)
-- ============================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, delete on public.project_follows, public.organization_follows to authenticated;

-- Funciones de trigger: no invocables directamente.
revoke execute on function public.profile_follows_check() from public;
revoke execute on function public.project_follows_check() from public;
revoke execute on function public.organization_follows_check() from public;
revoke execute on function public.profile_blocks_cleanup_follows() from public;

-- RPCs de conteo: ejecutables por anon y authenticated.
revoke execute on function public.count_profile_followers(uuid) from public;
grant execute on function public.count_profile_followers(uuid) to anon, authenticated;
revoke execute on function public.count_profile_following(uuid) from public;
grant execute on function public.count_profile_following(uuid) to anon, authenticated;
revoke execute on function public.count_project_followers(uuid) from public;
grant execute on function public.count_project_followers(uuid) to anon, authenticated;
revoke execute on function public.count_organization_followers(uuid) from public;
grant execute on function public.count_organization_followers(uuid) to anon, authenticated;

commit;
