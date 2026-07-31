create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  full_name text,
  headline text,
  bio text,
  avatar_url text,
  location text,
  user_types text[] not null default '{}',
  weekly_availability integer,
  collaboration_preferences text[] not null default '{}',
  website_url text,
  linkedin_url text,
  is_public boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null
      or (
        length(username) between 3 and 30
        and username ~ '^[a-z0-9_-]+$'
      )
  ),
  constraint profiles_user_types_check check (
    user_types <@ array['emprendedor', 'colaborador', 'mentor', 'profesional', 'inversor', 'empresa', 'institucion']::text[]
      and array_position(user_types, null::text) is null
  ),
  constraint profiles_collaboration_preferences_check check (
    collaboration_preferences <@ array['remunerado', 'participacion', 'intercambio', 'voluntario', 'cofundador', 'no_disponible']::text[]
      and array_position(collaboration_preferences, null::text) is null
  ),
  constraint profiles_weekly_availability_check check (
    weekly_availability is null or weekly_availability between 0 and 168
  ),
  constraint profiles_website_url_check check (
    website_url is null or website_url ~* '^https?://[^[:space:]]+$'
  ),
  constraint profiles_linkedin_url_check check (
    linkedin_url is null or linkedin_url ~* '^https?://[^[:space:]]+$'
  )
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.profile_skills (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  level smallint check (level between 1 and 5),
  primary key (profile_id, skill_id)
);

create table public.profile_interests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique on public.profiles (lower(username));
create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_is_public_idx on public.profiles (is_public);
create index if not exists profile_skills_skill_id_idx on public.profile_skills (skill_id);
create index if not exists profile_interests_profile_id_idx on public.profile_interests (profile_id);
create unique index if not exists profile_interests_profile_name_lower_unique on public.profile_interests (profile_id, lower(name));

insert into public.skills (name, slug) values
  ('Desarrollo web', 'desarrollo-web'),
  ('Desarrollo móvil', 'desarrollo-movil'),
  ('Inteligencia artificial', 'inteligencia-artificial'),
  ('Diseño UX/UI', 'diseno-ux-ui'),
  ('Marketing', 'marketing'),
  ('Ventas', 'ventas'),
  ('Finanzas', 'finanzas'),
  ('Fiscalidad', 'fiscalidad'),
  ('Legal', 'legal'),
  ('Operaciones', 'operaciones'),
  ('Producto', 'producto'),
  ('Gestión de proyectos', 'gestion-de-proyectos'),
  ('Comercio electrónico', 'comercio-electronico'),
  ('Industria', 'industria'),
  ('Sostenibilidad', 'sostenibilidad')
on conflict (name) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create or replace function public.normalize_profile_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is not null then
    new.username = lower(btrim(new.username));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_normalize_username on public.profiles;
create trigger profiles_normalize_username
  before insert or update on public.profiles
  for each row execute function public.normalize_profile_username();

create or replace function public.profiles_prevent_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'no se puede cambiar el id de un perfil';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_id_change on public.profiles;
create trigger profiles_prevent_id_change
  before update on public.profiles
  for each row execute function public.profiles_prevent_id_change();

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.profile_skills enable row level security;
alter table public.profile_interests enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (is_public = true);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "skills_select_all" on public.skills;
create policy "skills_select_all"
  on public.skills for select
  using (true);

drop policy if exists "profile_skills_select_public" on public.profile_skills;
create policy "profile_skills_select_public"
  on public.profile_skills for select
  using (
    exists (
      select 1 from public.profiles
      where id = profile_id and is_public = true
    )
  );

drop policy if exists "profile_skills_select_own" on public.profile_skills;
create policy "profile_skills_select_own"
  on public.profile_skills for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_skills_insert_own" on public.profile_skills;
create policy "profile_skills_insert_own"
  on public.profile_skills for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_skills_update_own" on public.profile_skills;
create policy "profile_skills_update_own"
  on public.profile_skills for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "profile_skills_delete_own" on public.profile_skills;
create policy "profile_skills_delete_own"
  on public.profile_skills for delete
  using (auth.uid() = profile_id);

drop policy if exists "profile_interests_select_public" on public.profile_interests;
create policy "profile_interests_select_public"
  on public.profile_interests for select
  using (
    exists (
      select 1 from public.profiles
      where id = profile_id and is_public = true
    )
  );

drop policy if exists "profile_interests_select_own" on public.profile_interests;
create policy "profile_interests_select_own"
  on public.profile_interests for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_interests_insert_own" on public.profile_interests;
create policy "profile_interests_insert_own"
  on public.profile_interests for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_interests_update_own" on public.profile_interests;
create policy "profile_interests_update_own"
  on public.profile_interests for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "profile_interests_delete_own" on public.profile_interests;
create policy "profile_interests_delete_own"
  on public.profile_interests for delete
  using (auth.uid() = profile_id);

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.skills, public.profile_skills, public.profile_interests to anon, authenticated;
grant update on public.profiles to authenticated;
grant select, insert, update, delete on public.profile_skills, public.profile_interests to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
where id = 'avatars';

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
  );
