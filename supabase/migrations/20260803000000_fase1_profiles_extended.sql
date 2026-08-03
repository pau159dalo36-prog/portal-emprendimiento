-- FASE 1 — Ampliación de perfiles (migración no destructiva)
-- Añade únicamente columnas y tablas nuevas. No modifica ni elimina nada existente.

-- Tipos de usuario extensibles (catálogo). El array `profiles.user_types` se mantiene;
-- este catálogo permite ampliar roles sin cambiar la columna.
create table public.professional_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.professional_roles (name, slug, description, sort_order) values
  ('Emprendedor', 'emprendedor', null, 1),
  ('Colaborador', 'colaborador', null, 2),
  ('Mentor', 'mentor', null, 3),
  ('Profesional', 'profesional', null, 4),
  ('Inversor', 'inversor', null, 5),
  ('Empresa', 'empresa', null, 6),
  ('Institución', 'institucion', null, 7)
on conflict (slug) do nothing;

-- Columnas nuevas en `profiles` (todas nullable; no afectan a filas existentes)
alter table public.profiles
  add column if not exists contact_email text,
  add column if not exists timezone text;

alter table public.profiles
  drop constraint if exists profiles_contact_email_check,
  add constraint profiles_contact_email_check check (
    contact_email is null or contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  );

alter table public.profiles
  drop constraint if exists profiles_timezone_check,
  add constraint profiles_timezone_check check (
    timezone is null or timezone ~ '^[A-Za-z_]+/[A-Za-z_]+$'
  );

-- Idiomas hablados por el perfil (código ISO 639-1 + nivel 1-5)
create table public.profile_languages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  proficiency smallint check (proficiency between 1 and 5),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, code),
  constraint profile_languages_code_check check (code ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

-- Experiencia profesional
create table public.profile_experience (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  company text not null,
  role text not null,
  location text,
  description text,
  start_month smallint check (start_month between 1 and 12),
  start_year integer check (start_year between 1900 and 2100),
  end_month smallint check (end_month between 1 and 12),
  end_year integer check (end_year between 1900 and 2100),
  is_current boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint profile_experience_start_date_check check (
    (start_year is null and start_month is null)
      or (start_year is not null and start_month is not null)
  ),
  constraint profile_experience_end_date_check check (
    (end_year is null and end_month is null)
      or (end_year is not null and end_month is not null)
  ),
  constraint profile_experience_range_check check (
    start_year is null
      or end_year is null
      or (end_year > start_year or (end_year = start_year and end_month >= start_month))
  ),
  constraint profile_experience_current_check check (
    is_current = false or end_year is null
  )
);

-- Formación académica
create table public.profile_education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  institution text not null,
  degree text,
  field_of_study text,
  description text,
  start_year integer check (start_year between 1900 and 2100),
  end_year integer check (end_year between 1900 and 2100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint profile_education_range_check check (
    start_year is null or end_year is null or end_year >= start_year
  )
);

-- Enlaces externos del perfil
create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  link_type text not null,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint profile_links_type_check check (
    link_type in ('website', 'linkedin', 'github', 'twitter', 'instagram', 'other')
  ),
  constraint profile_links_url_check check (
    url ~* '^https?://[^[:space:]]+$'
  )
);

-- Logros y reconocimientos
create table public.profile_achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  achieved_on date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Preferencias del perfil (1:1 con `profiles`)
create table public.profile_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  visible_contact_email boolean not null default false,
  visible_experience boolean not null default true,
  visible_education boolean not null default true,
  visible_skills boolean not null default true,
  visible_achievements boolean not null default true,
  receive_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profile_preferences_set_updated_at on public.profile_preferences;
create trigger profile_preferences_set_updated_at
  before update on public.profile_preferences
  for each row execute function public.handle_updated_at();

-- Bloqueos entre perfiles (privacy)
create table public.profile_blocks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (profile_id, blocked_id),
  constraint profile_blocks_self_check check (profile_id <> blocked_id)
);

-- Seguimiento entre perfiles
create table public.profile_follows (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, following_id),
  constraint profile_follows_self_check check (profile_id <> following_id)
);

-- Índices
create index if not exists professional_roles_sort_order_idx on public.professional_roles (sort_order);
create index if not exists profile_languages_profile_id_idx on public.profile_languages (profile_id);
create index if not exists profile_experience_profile_id_idx on public.profile_experience (profile_id);
create index if not exists profile_education_profile_id_idx on public.profile_education (profile_id);
create index if not exists profile_links_profile_id_idx on public.profile_links (profile_id);
create index if not exists profile_achievements_profile_id_idx on public.profile_achievements (profile_id);
create index if not exists profile_blocks_profile_id_idx on public.profile_blocks (profile_id);
create index if not exists profile_blocks_blocked_id_idx on public.profile_blocks (blocked_id);
create index if not exists profile_follows_profile_id_idx on public.profile_follows (profile_id);
create index if not exists profile_follows_following_id_idx on public.profile_follows (following_id);

-- Row Level Security
alter table public.professional_roles enable row level security;
alter table public.profile_languages enable row level security;
alter table public.profile_experience enable row level security;
alter table public.profile_education enable row level security;
alter table public.profile_links enable row level security;
alter table public.profile_achievements enable row level security;
alter table public.profile_preferences enable row level security;
alter table public.profile_blocks enable row level security;
alter table public.profile_follows enable row level security;

drop policy if exists "professional_roles_select_all" on public.professional_roles;
create policy "professional_roles_select_all"
  on public.professional_roles for select
  using (true);

drop policy if exists "profile_languages_select_public" on public.profile_languages;
create policy "profile_languages_select_public"
  on public.profile_languages for select
  using (
    exists (
      select 1 from public.profiles
      where id = profile_id and is_public = true
    )
  );

drop policy if exists "profile_languages_select_own" on public.profile_languages;
create policy "profile_languages_select_own"
  on public.profile_languages for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_languages_insert_own" on public.profile_languages;
create policy "profile_languages_insert_own"
  on public.profile_languages for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_languages_update_own" on public.profile_languages;
create policy "profile_languages_update_own"
  on public.profile_languages for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "profile_languages_delete_own" on public.profile_languages;
create policy "profile_languages_delete_own"
  on public.profile_languages for delete
  using (auth.uid() = profile_id);

drop policy if exists "profile_experience_select_public" on public.profile_experience;
create policy "profile_experience_select_public"
  on public.profile_experience for select
  using (
    exists (
      select 1 from public.profiles
      where id = profile_id and is_public = true
    )
  );

drop policy if exists "profile_experience_select_own" on public.profile_experience;
create policy "profile_experience_select_own"
  on public.profile_experience for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_experience_insert_own" on public.profile_experience;
create policy "profile_experience_insert_own"
  on public.profile_experience for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_experience_update_own" on public.profile_experience;
create policy "profile_experience_update_own"
  on public.profile_experience for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "profile_experience_delete_own" on public.profile_experience;
create policy "profile_experience_delete_own"
  on public.profile_experience for delete
  using (auth.uid() = profile_id);

drop policy if exists "profile_education_select_public" on public.profile_education;
create policy "profile_education_select_public"
  on public.profile_education for select
  using (
    exists (
      select 1 from public.profiles
      where id = profile_id and is_public = true
    )
  );

drop policy if exists "profile_education_select_own" on public.profile_education;
create policy "profile_education_select_own"
  on public.profile_education for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_education_insert_own" on public.profile_education;
create policy "profile_education_insert_own"
  on public.profile_education for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_education_update_own" on public.profile_education;
create policy "profile_education_update_own"
  on public.profile_education for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "profile_education_delete_own" on public.profile_education;
create policy "profile_education_delete_own"
  on public.profile_education for delete
  using (auth.uid() = profile_id);

drop policy if exists "profile_links_select_public" on public.profile_links;
create policy "profile_links_select_public"
  on public.profile_links for select
  using (
    exists (
      select 1 from public.profiles
      where id = profile_id and is_public = true
    )
  );

drop policy if exists "profile_links_select_own" on public.profile_links;
create policy "profile_links_select_own"
  on public.profile_links for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_links_insert_own" on public.profile_links;
create policy "profile_links_insert_own"
  on public.profile_links for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_links_update_own" on public.profile_links;
create policy "profile_links_update_own"
  on public.profile_links for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "profile_links_delete_own" on public.profile_links;
create policy "profile_links_delete_own"
  on public.profile_links for delete
  using (auth.uid() = profile_id);

drop policy if exists "profile_achievements_select_public" on public.profile_achievements;
create policy "profile_achievements_select_public"
  on public.profile_achievements for select
  using (
    exists (
      select 1 from public.profiles
      where id = profile_id and is_public = true
    )
  );

drop policy if exists "profile_achievements_select_own" on public.profile_achievements;
create policy "profile_achievements_select_own"
  on public.profile_achievements for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_achievements_insert_own" on public.profile_achievements;
create policy "profile_achievements_insert_own"
  on public.profile_achievements for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_achievements_update_own" on public.profile_achievements;
create policy "profile_achievements_update_own"
  on public.profile_achievements for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "profile_achievements_delete_own" on public.profile_achievements;
create policy "profile_achievements_delete_own"
  on public.profile_achievements for delete
  using (auth.uid() = profile_id);

drop policy if exists "profile_preferences_select_public" on public.profile_preferences;
create policy "profile_preferences_select_public"
  on public.profile_preferences for select
  using (
    exists (
      select 1 from public.profiles
      where id = profile_id and is_public = true
    )
  );

drop policy if exists "profile_preferences_select_own" on public.profile_preferences;
create policy "profile_preferences_select_own"
  on public.profile_preferences for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_preferences_insert_own" on public.profile_preferences;
create policy "profile_preferences_insert_own"
  on public.profile_preferences for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_preferences_update_own" on public.profile_preferences;
create policy "profile_preferences_update_own"
  on public.profile_preferences for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "profile_preferences_delete_own" on public.profile_preferences;
create policy "profile_preferences_delete_own"
  on public.profile_preferences for delete
  using (auth.uid() = profile_id);

drop policy if exists "profile_blocks_select_own" on public.profile_blocks;
create policy "profile_blocks_select_own"
  on public.profile_blocks for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_blocks_insert_own" on public.profile_blocks;
create policy "profile_blocks_insert_own"
  on public.profile_blocks for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_blocks_delete_own" on public.profile_blocks;
create policy "profile_blocks_delete_own"
  on public.profile_blocks for delete
  using (auth.uid() = profile_id);

drop policy if exists "profile_follows_select_own" on public.profile_follows;
create policy "profile_follows_select_own"
  on public.profile_follows for select
  using (auth.uid() = profile_id);

drop policy if exists "profile_follows_select_followers" on public.profile_follows;
create policy "profile_follows_select_followers"
  on public.profile_follows for select
  using (auth.uid() = following_id);

drop policy if exists "profile_follows_insert_own" on public.profile_follows;
create policy "profile_follows_insert_own"
  on public.profile_follows for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_follows_delete_own" on public.profile_follows;
create policy "profile_follows_delete_own"
  on public.profile_follows for delete
  using (auth.uid() = profile_id);

-- Permisos (auto_expose_new_tables está desactivado: se conceden explícitamente)
grant usage on schema public to anon, authenticated;

grant select on public.professional_roles, public.profile_languages, public.profile_experience,
  public.profile_education, public.profile_links, public.profile_achievements, public.profile_preferences
  to anon, authenticated;

grant select, insert, update, delete on public.profile_languages, public.profile_experience,
  public.profile_education, public.profile_links, public.profile_achievements, public.profile_preferences
  to authenticated;

grant select, insert, delete on public.profile_blocks, public.profile_follows to authenticated;
