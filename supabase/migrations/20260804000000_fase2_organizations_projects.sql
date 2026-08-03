-- FASE 2 — Organizaciones y proyectos (migración no destructiva)
-- Añade únicamente tablas y funciones nuevas. No modifica ni elimina nada existente.

-- Organizaciones
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique,
  name text not null,
  headline text,
  description text,
  logo_url text,
  website_url text,
  contact_email text,
  location text,
  industries text[] not null default '{}',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_format check (
    length(slug) between 3 and 30
      and slug ~ '^[a-z0-9_-]+$'
  ),
  constraint organizations_name_length check (length(name) between 2 and 120),
  constraint organizations_industries_check check (
    industries <@ array['tecnologia', 'salud', 'educacion', 'finanzas', 'alimentacion',
      'retail', 'energia', 'sostenibilidad', 'cultura', 'deporte', 'otros']::text[]
      and array_position(industries, null::text) is null
  ),
  constraint organizations_website_url_check check (
    website_url is null or website_url ~* '^https?://[^[:space:]]+$'
  ),
  constraint organizations_contact_email_check check (
    contact_email is null or contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  )
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, profile_id),
  constraint organization_members_role_check check (
    role in ('owner', 'admin', 'member')
  )
);

create table public.organization_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  link_type text not null,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint organization_links_type_check check (
    link_type in ('website', 'linkedin', 'github', 'twitter', 'instagram', 'other')
  ),
  constraint organization_links_url_check check (
    url ~* '^https?://[^[:space:]]+$'
  )
);

-- Proyectos
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  slug text not null unique,
  name text not null,
  tagline text,
  description text,
  problem text,
  solution text,
  target_market text,
  traction text,
  stage text not null default 'idea',
  status text not null default 'draft',
  is_public boolean not null default false,
  industries text[] not null default '{}',
  cover_image_url text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_slug_format check (
    length(slug) between 3 and 60
      and slug ~ '^[a-z0-9_-]+$'
  ),
  constraint projects_name_length check (length(name) between 2 and 120),
  constraint projects_stage_check check (
    stage in ('idea', 'validacion', 'prototipo', 'lanzamiento', 'crecimiento')
  ),
  constraint projects_status_check check (
    status in ('draft', 'published', 'archived')
  ),
  constraint projects_industries_check check (
    industries <@ array['tecnologia', 'salud', 'educacion', 'finanzas', 'alimentacion',
      'retail', 'energia', 'sostenibilidad', 'cultura', 'deporte', 'otros']::text[]
      and array_position(industries, null::text) is null
  ),
  constraint projects_cover_image_url_check check (
    cover_image_url is null or cover_image_url ~* '^https?://[^[:space:]]+$'
  ),
  constraint projects_website_url_check check (
    website_url is null or website_url ~* '^https?://[^[:space:]]+$'
  )
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'contributor',
  created_at timestamptz not null default now(),
  unique (project_id, profile_id),
  constraint project_members_role_check check (
    role in ('owner', 'cofounder', 'admin', 'contributor', 'advisor')
  )
);

-- Necesidades del proyecto (perfiles o habilidades que busca)
create table public.project_needs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  skill_id uuid references public.skills (id) on delete set null,
  title text not null,
  description text,
  commitment text,
  status text not null default 'open',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint project_needs_status_check check (
    status in ('open', 'closed', 'filled')
  )
);

create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  link_type text not null,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint project_links_type_check check (
    link_type in ('website', 'github', 'twitter', 'linkedin', 'discord', 'docs', 'other')
  ),
  constraint project_links_url_check check (
    url ~* '^https?://[^[:space:]]+$'
  )
);

-- Índices
create index if not exists organizations_owner_id_idx on public.organizations (owner_id);
create index if not exists organizations_is_public_idx on public.organizations (is_public);
create index if not exists organization_members_organization_id_idx on public.organization_members (organization_id);
create index if not exists organization_members_profile_id_idx on public.organization_members (profile_id);
create index if not exists organization_links_organization_id_idx on public.organization_links (organization_id);
create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists projects_organization_id_idx on public.projects (organization_id);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_is_public_idx on public.projects (is_public);
create index if not exists projects_listing_idx on public.projects (is_public, status, created_at desc);
create index if not exists project_members_project_id_idx on public.project_members (project_id);
create index if not exists project_members_profile_id_idx on public.project_members (profile_id);
create index if not exists project_needs_project_id_idx on public.project_needs (project_id);
create index if not exists project_needs_skill_id_idx on public.project_needs (skill_id);
create unique index if not exists project_needs_project_title_lower_unique on public.project_needs (project_id, lower(title));
create index if not exists project_links_project_id_idx on public.project_links (project_id);

-- Triggers
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

create or replace function public.normalize_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is not null then
    new.slug = lower(btrim(new.slug));
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_normalize_slug on public.organizations;
create trigger organizations_normalize_slug
  before insert or update on public.organizations
  for each row execute function public.normalize_slug();

drop trigger if exists projects_normalize_slug on public.projects;
create trigger projects_normalize_slug
  before insert or update on public.projects
  for each row execute function public.normalize_slug();

-- El propietario se convierte automáticamente en miembro con rol owner
create or replace function public.organizations_add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_members (organization_id, profile_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (organization_id, profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_add_owner_member on public.organizations;
create trigger organizations_add_owner_member
  after insert on public.organizations
  for each row execute function public.organizations_add_owner_member();

create or replace function public.projects_add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, profile_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists projects_add_owner_member on public.projects;
create trigger projects_add_owner_member
  after insert on public.projects
  for each row execute function public.projects_add_owner_member();

create or replace function public.prevent_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'no se puede cambiar el id de un registro';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_prevent_id_change on public.organizations;
create trigger organizations_prevent_id_change
  before update on public.organizations
  for each row execute function public.prevent_id_change();

drop trigger if exists projects_prevent_id_change on public.projects;
create trigger projects_prevent_id_change
  before update on public.projects
  for each row execute function public.prevent_id_change();

-- Funciones de membresía (SECURITY DEFINER con search_path='' y nombres completos).
-- Se usan dentro de políticas para evitar recursión de RLS (una política no debe
-- consultar directamente la tabla sobre la que se aplica).
create or replace function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and profile_id = auth.uid()
  );
$$;

create or replace function public.is_organization_manager(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and profile_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and profile_id = auth.uid()
  );
$$;

-- Row Level Security
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_links enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_needs enable row level security;
alter table public.project_links enable row level security;

-- organizations
drop policy if exists "organizations_select_public" on public.organizations;
create policy "organizations_select_public"
  on public.organizations for select
  using (is_public = true);

drop policy if exists "organizations_select_own" on public.organizations;
create policy "organizations_select_own"
  on public.organizations for select
  using (auth.uid() = owner_id);

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  using (public.is_organization_member(id));

drop policy if exists "organizations_insert_own" on public.organizations;
create policy "organizations_insert_own"
  on public.organizations for insert
  with check (auth.uid() = owner_id);

drop policy if exists "organizations_update_own" on public.organizations;
create policy "organizations_update_own"
  on public.organizations for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "organizations_delete_own" on public.organizations;
create policy "organizations_delete_own"
  on public.organizations for delete
  using (auth.uid() = owner_id);

-- organization_members
drop policy if exists "organization_members_select_public" on public.organization_members;
create policy "organization_members_select_public"
  on public.organization_members for select
  using (
    exists (
      select 1 from public.organizations
      where id = organization_id and is_public = true
    )
  );

drop policy if exists "organization_members_select_own_row" on public.organization_members;
create policy "organization_members_select_own_row"
  on public.organization_members for select
  using (auth.uid() = profile_id);

drop policy if exists "organization_members_select_member" on public.organization_members;
create policy "organization_members_select_member"
  on public.organization_members for select
  using (public.is_organization_member(organization_id));

drop policy if exists "organization_members_insert_manage" on public.organization_members;
create policy "organization_members_insert_manage"
  on public.organization_members for insert
  with check (
    public.is_organization_manager(organization_id)
      and role <> 'owner'
      and not exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.owner_id = profile_id
      )
  );

drop policy if exists "organization_members_update_manage" on public.organization_members;
create policy "organization_members_update_manage"
  on public.organization_members for update
  using (
    public.is_organization_manager(organization_id)
      and not exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.owner_id = profile_id
      )
  )
  with check (
    public.is_organization_manager(organization_id)
      and role <> 'owner'
      and not exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.owner_id = profile_id
      )
  );

drop policy if exists "organization_members_delete_manage" on public.organization_members;
create policy "organization_members_delete_manage"
  on public.organization_members for delete
  using (
    public.is_organization_manager(organization_id)
      and not exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.owner_id = profile_id
      )
  );

-- organization_links
drop policy if exists "organization_links_select_public" on public.organization_links;
create policy "organization_links_select_public"
  on public.organization_links for select
  using (
    exists (
      select 1 from public.organizations
      where id = organization_id and is_public = true
    )
  );

drop policy if exists "organization_links_select_own" on public.organization_links;
create policy "organization_links_select_own"
  on public.organization_links for select
  using (
    exists (
      select 1 from public.organizations o
      where o.id = organization_id and o.owner_id = auth.uid()
    )
  );

drop policy if exists "organization_links_select_member" on public.organization_links;
create policy "organization_links_select_member"
  on public.organization_links for select
  using (public.is_organization_member(organization_id));

drop policy if exists "organization_links_insert_manage" on public.organization_links;
create policy "organization_links_insert_manage"
  on public.organization_links for insert
  with check (public.is_organization_manager(organization_id));

drop policy if exists "organization_links_update_manage" on public.organization_links;
create policy "organization_links_update_manage"
  on public.organization_links for update
  using (public.is_organization_manager(organization_id))
  with check (public.is_organization_manager(organization_id));

drop policy if exists "organization_links_delete_manage" on public.organization_links;
create policy "organization_links_delete_manage"
  on public.organization_links for delete
  using (public.is_organization_manager(organization_id));

-- projects
drop policy if exists "projects_select_public" on public.projects;
create policy "projects_select_public"
  on public.projects for select
  using (is_public = true and status = 'published');

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = owner_id);

drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member"
  on public.projects for select
  using (public.is_project_member(id));

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = owner_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = owner_id);

-- project_members
drop policy if exists "project_members_select_public" on public.project_members;
create policy "project_members_select_public"
  on public.project_members for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id and is_public = true and status = 'published'
    )
  );

drop policy if exists "project_members_select_own_row" on public.project_members;
create policy "project_members_select_own_row"
  on public.project_members for select
  using (auth.uid() = profile_id);

drop policy if exists "project_members_select_member" on public.project_members;
create policy "project_members_select_member"
  on public.project_members for select
  using (public.is_project_member(project_id));

drop policy if exists "project_members_insert_own" on public.project_members;
create policy "project_members_insert_own"
  on public.project_members for insert
  with check (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
      and role <> 'owner'
      and not exists (
        select 1 from public.projects p
        where p.id = project_id and p.owner_id = profile_id
      )
  );

drop policy if exists "project_members_update_own" on public.project_members;
create policy "project_members_update_own"
  on public.project_members for update
  using (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
      and not exists (
        select 1 from public.projects p
        where p.id = project_id and p.owner_id = profile_id
      )
  )
  with check (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
      and role <> 'owner'
      and not exists (
        select 1 from public.projects p
        where p.id = project_id and p.owner_id = profile_id
      )
  );

drop policy if exists "project_members_delete_own" on public.project_members;
create policy "project_members_delete_own"
  on public.project_members for delete
  using (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
      and not exists (
        select 1 from public.projects p
        where p.id = project_id and p.owner_id = profile_id
      )
  );

-- project_needs
drop policy if exists "project_needs_select_public" on public.project_needs;
create policy "project_needs_select_public"
  on public.project_needs for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id and is_public = true and status = 'published'
    )
  );

drop policy if exists "project_needs_select_own" on public.project_needs;
create policy "project_needs_select_own"
  on public.project_needs for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
  );

drop policy if exists "project_needs_select_member" on public.project_needs;
create policy "project_needs_select_member"
  on public.project_needs for select
  using (public.is_project_member(project_id));

drop policy if exists "project_needs_insert_manage" on public.project_needs;
create policy "project_needs_insert_manage"
  on public.project_needs for insert
  with check (public.is_project_member(project_id));

drop policy if exists "project_needs_update_manage" on public.project_needs;
create policy "project_needs_update_manage"
  on public.project_needs for update
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "project_needs_delete_manage" on public.project_needs;
create policy "project_needs_delete_manage"
  on public.project_needs for delete
  using (public.is_project_member(project_id));

-- project_links
drop policy if exists "project_links_select_public" on public.project_links;
create policy "project_links_select_public"
  on public.project_links for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id and is_public = true and status = 'published'
    )
  );

drop policy if exists "project_links_select_own" on public.project_links;
create policy "project_links_select_own"
  on public.project_links for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
  );

drop policy if exists "project_links_select_member" on public.project_links;
create policy "project_links_select_member"
  on public.project_links for select
  using (public.is_project_member(project_id));

drop policy if exists "project_links_insert_manage" on public.project_links;
create policy "project_links_insert_manage"
  on public.project_links for insert
  with check (public.is_project_member(project_id));

drop policy if exists "project_links_update_manage" on public.project_links;
create policy "project_links_update_manage"
  on public.project_links for update
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "project_links_delete_manage" on public.project_links;
create policy "project_links_delete_manage"
  on public.project_links for delete
  using (public.is_project_member(project_id));

-- Permisos (auto_expose_new_tables está desactivado: se conceden explícitamente)
grant usage on schema public to anon, authenticated;

grant select on public.organizations, public.organization_members, public.organization_links,
  public.projects, public.project_members, public.project_needs, public.project_links
  to anon, authenticated;

grant select, insert, update, delete on public.organizations, public.organization_members,
  public.organization_links, public.projects, public.project_members, public.project_needs,
  public.project_links to authenticated;
