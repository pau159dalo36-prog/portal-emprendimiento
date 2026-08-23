-- FASE 6 — Mercado de Oportunidades (migración NO destructiva)
-- ============================================================================
-- Objetivo: mercado público de oportunidades con perfil rico (empleo,
-- prácticas, cofundador, colaboración y trabajos de 1 día/turnos), búsqueda
-- con el mismo estándar de FASE 5 y distribución vía `posts` (un post por
-- oportunidad publicada, idempotente).
--
-- Decisiones de diseño:
--
--  * Convivencia con `project_needs`: se crea una tabla NUEVA y dedicada
--    `opportunities`. `project_needs` (FASE 2) NO se toca: sigue siendo la
--    lista de necesidades/habilidades del detalle de un proyecto. Una
--    oportunidad puede anclarse a un proyecto (`project_id` nullable), a una
--    organización (`organization_id` nullable) o existir como creator personal.
--
--  * Taxonomía por `opportunity_type` + flags:
--      opportunity_type ∈ job | internship | cofounder | collaboration | one_day_shift
--      is_first_job_friendly / is_student_friendly (NO hay tipo "primer empleo":
--      se modela con el flag y con el filtro combinado de búsqueda).
--
--  * Compensación con semántica explícita (nunca cantidades sin unidad):
--      compensation_type   ∈ monetary | equity | negotiable | unpaid
--      compensation_period ∈ hour | shift | day | week | month | year | one_time
--      'monetary' exige moneda ISO-4217 + periodo + al menos un límite
--      (min <= max si ambos). Los demás tipos PROHÍBEN cantidades. Un turno
--      monetario solo admite periodo shift|day (p. ej. "75 EUR por turno").
--
--  * Ciclo de vida: draft → published → closed|filled|cancelled (terminal).
--    Moderación POST-publicación (patrón de vídeos): unreviewed|approved|
--    rejected|flagged. Distribuible = unreviewed/approved; rejected/flagged
--    bloqueados de inmediato. `moderated_by/moderated_at/moderation_reason`
--    son auditabilidad obligatoria para estados revisados.
--
--  * Trabajos de 1 día: un turno pasada su `ends_at` NO es distribuible aunque
--    siga 'published'. Se DERIVA en consulta (predicado
--    `opportunity_is_publicly_distributable` + RLS + search): sin cronjobs.
--
--  * POSTS como unidad de distribución: `posts` gana `opportunity_id` (unique).
--    El trigger `posts_sync_from_opportunity` (SECURITY DEFINER porque el ciclo
--    puede gestionarlo un miembro del proyecto/org o un admin, no solo el
--    creador) garantiza EXACTAMENTE un post publicado por oportunidad publicada
--    (INSERT ... ON CONFLICT (opportunity_id) DO UPDATE, idempotente) y retira
--    la distribución al cerrar/cubrir/cancelar o al rechazar/marcar. Los posts
--    de vídeo existentes NO se tocan.
--
--  * Feed: los posts de oportunidad NO entran todavía en "Para ti"/"Siguiendo"
--    (las RPCs de feed se recrean con `p.post_type = 'video'`; su tarjeta es
--    100% vídeo). La distribución pública de oportunidades ocurre vía
--    /oportunidades, /explorar y `search_opportunities`. La integración al
--    feed se documenta como follow-up.
--
--  * Seguridad: RLS estricta (sin política DELETE: ciclo de vida). INSERT solo
--    authenticated y con contexto autorizado (creator propio; si ancla
--    proyecto/organización, membresía real reutilizando is_project_member /
--    is_organization_member). UPDATE solo creador/miembro del contexto/admin.
--    La moderación es SOLO administrativa (RPCs admin_*_opportunity SECURITY
--    DEFINER + trigger de validación, patrón exacto de vídeos).
--
--  * ACL explícita de TODO lo nuevo (revoke-first, luego grant mínimo).
--    No se depende de default privileges.

begin;

-- ============================================================================
-- 1. Tabla `opportunities`
-- ============================================================================
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  title text not null,
  description text not null,
  opportunity_type text not null default 'collaboration',
  employment_type text,
  experience_level text,
  work_mode text,
  industry text,
  country text,
  region text,
  city text,
  location_text text,
  status text not null default 'draft',
  visibility text not null default 'public',
  moderation_status text not null default 'unreviewed',
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  moderation_reason text,
  is_first_job_friendly boolean not null default false,
  is_student_friendly boolean not null default false,
  compensation_type text not null default 'negotiable',
  compensation_min numeric,
  compensation_max numeric,
  currency text,
  compensation_period text,
  starts_at timestamptz,
  ends_at timestamptz,
  slots_total integer,
  closes_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint opportunities_type_check check (
    opportunity_type in ('job', 'internship', 'cofounder', 'collaboration', 'one_day_shift')
  ),
  constraint opportunities_employment_type_check check (
    employment_type is null or employment_type in ('full_time', 'part_time', 'contract', 'freelance', 'temporary')
  ),
  constraint opportunities_work_mode_check check (
    work_mode is null or work_mode in ('on_site', 'remote', 'hybrid')
  ),
  constraint opportunities_experience_level_check check (
    experience_level is null or experience_level in ('no_experience', 'junior', 'mid', 'senior', 'expert')
  ),
  constraint opportunities_industry_check check (
    industry is null or industry in (
      'tecnologia', 'salud', 'educacion', 'finanzas', 'alimentacion',
      'retail', 'energia', 'sostenibilidad', 'cultura', 'deporte', 'otros'
    )
  ),
  constraint opportunities_status_check check (
    status in ('draft', 'published', 'closed', 'filled', 'cancelled')
  ),
  constraint opportunities_visibility_check check (
    visibility in ('public', 'registered_users', 'project_members', 'private', 'unlisted')
  ),
  constraint opportunities_moderation_status_check check (
    moderation_status in ('unreviewed', 'approved', 'rejected', 'flagged')
  ),
  constraint opportunities_moderation_state_check check (
    moderation_status = 'unreviewed' or moderated_at is not null
  ),
  constraint opportunities_moderation_reason_length check (
    moderation_reason is null or length(moderation_reason) <= 500
  ),
  constraint opportunities_compensation_type_check check (
    compensation_type in ('monetary', 'equity', 'negotiable', 'unpaid')
  ),
  constraint opportunities_compensation_period_check check (
    compensation_period is null or compensation_period in ('hour', 'shift', 'day', 'week', 'month', 'year', 'one_time')
  ),
  constraint opportunities_currency_check check (
    currency is null or currency ~ '^[A-Z]{3}$'
  ),
  constraint opportunities_title_length check (
    length(btrim(title)) between 3 and 200
  ),
  constraint opportunities_description_length check (
    length(btrim(description)) between 10 and 5000
  ),
  constraint opportunities_published_at_check check (
    status <> 'published' or published_at is not null
  ),
  constraint opportunities_closes_at_check check (
    closes_at is null or closes_at > created_at
  ),
  -- Empleo/contrato: job e internship definen employment_type y work_mode;
  -- el resto de tipos no usan employment_type.
  constraint opportunities_employment_scope_check check (
    (opportunity_type in ('job', 'internship')
      and employment_type is not null
      and work_mode is not null)
    or (opportunity_type not in ('job', 'internship') and employment_type is null)
  ),
  -- Trabajo de 1 día: fechas obligatorias, fin > inicio, plazas > 0. El resto
  -- de tipos no usan turnos.
  constraint opportunities_one_day_shift_check check (
    (opportunity_type = 'one_day_shift'
      and starts_at is not null
      and ends_at is not null
      and ends_at > starts_at
      and slots_total is not null
      and slots_total > 0)
    or (opportunity_type <> 'one_day_shift'
      and starts_at is null and ends_at is null and slots_total is null)
  ),
  -- Compensación monetaria: unidad clara (currency + period) y al menos un
  -- límite con min <= max. No-monetaria (equity/negotiable/unpaid): sin
  -- cantidades. Un turno monetario solo admite period shift|day.
  constraint opportunities_compensation_check check (
    (compensation_type = 'monetary'
      and compensation_period is not null
      and currency is not null
      and (compensation_min is not null or compensation_max is not null)
      and (compensation_min is null or compensation_max is null or compensation_min <= compensation_max))
    or (compensation_type <> 'monetary'
      and compensation_min is null and compensation_max is null
      and compensation_period is null and currency is null)
  ),
  constraint opportunities_one_day_compensation_check check (
    not (opportunity_type = 'one_day_shift' and compensation_type = 'monetary')
    or compensation_period in ('shift', 'day')
  )
);

-- ============================================================================
-- 2. Índices (solo los necesarios: market, filtros y turnos; nada redundante)
-- ============================================================================
create index if not exists opportunities_creator_id_idx on public.opportunities (creator_id);
create index if not exists opportunities_project_id_idx on public.opportunities (project_id);
create index if not exists opportunities_organization_id_idx on public.opportunities (organization_id);
create index if not exists opportunities_opportunity_type_idx on public.opportunities (opportunity_type);
create index if not exists opportunities_status_idx on public.opportunities (status);
create index if not exists opportunities_visibility_idx on public.opportunities (visibility);
create index if not exists opportunities_moderation_status_idx on public.opportunities (moderation_status);
create index if not exists opportunities_published_at_idx on public.opportunities (published_at desc);
create index if not exists opportunities_listing_idx on public.opportunities (status, visibility, published_at desc);
create index if not exists opportunities_starts_at_idx on public.opportunities (starts_at);
create index if not exists opportunities_work_mode_idx on public.opportunities (work_mode);
create index if not exists opportunities_industry_idx on public.opportunities (industry);

-- ============================================================================
-- 3. `posts` gana `opportunity_id` (un post por oportunidad, en cascada)
-- ============================================================================
alter table public.posts add column opportunity_id uuid unique
  references public.opportunities (id) on delete cascade;

-- Coherencia tipo ↔ columna (espejo de posts_video_type_check).
alter table public.posts add constraint posts_opportunity_type_check check (
  (post_type = 'opportunity' and opportunity_id is not null)
  or (post_type <> 'opportunity' and opportunity_id is null)
);

-- ============================================================================
-- 4. Predicado canónico de distributividad de una oportunidad
-- ============================================================================
-- true cuando está publicada, no rechazada/marcada y (para turnos) aún no ha
-- terminado. NO valora el tier de visibilidad (lo gobiernan las políticas RLS),
-- igual que video_is_publicly_distributable. El "pasado de turno" se deriva en
-- consulta: no requiere cronjob.
create or replace function public.opportunity_is_publicly_distributable(
  p_status text,
  p_visibility text,
  p_moderation_status text,
  p_opportunity_type text,
  p_ends_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'published'
    and p_moderation_status is not null
    and not (p_moderation_status in ('rejected', 'flagged'))
    and (p_opportunity_type <> 'one_day_shift'
         or p_ends_at is null
         or p_ends_at > now());
$$;

-- ============================================================================
-- 5. Trigger de ciclo de vida y validación de estado
-- ============================================================================
create or replace function public.opportunities_validate_state_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.creator_id is distinct from old.creator_id then
      raise exception 'no se puede cambiar el creador de una oportunidad';
    end if;

    -- Moderación exclusivamente administrativa (patrón de vídeos): cualquier
    -- cambio de `moderation_status` o de sus campos de auditoría exige un
    -- administrador de plataforma distinto del creador. Se verifica con
    -- auth.jwt() vía is_platform_admin(); no se confía en variables de sesión.
    if new.moderation_status is distinct from old.moderation_status
       or new.moderated_by is distinct from old.moderated_by
       or new.moderated_at is distinct from old.moderated_at
       or new.moderation_reason is distinct from old.moderation_reason then
      if not public.is_platform_admin() then
        raise exception 'la moderación solo puede gestionarla un administrador';
      end if;
      if new.creator_id = auth.uid() then
        raise exception 'un administrador no puede moderar sus propias oportunidades';
      end if;
    end if;

    -- No se publica un turno que ya ha terminado.
    if new.status = 'published'
       and old.status is distinct from 'published'
       and new.ends_at is not null
       and new.ends_at <= now() then
      raise exception 'no se puede publicar una oportunidad de turno ya pasada';
    end if;

    -- Al publicar, fijar published_at (la constraint lo exige y el sync lo usa).
    if new.status = 'published' and old.status is distinct from 'published' then
      new.published_at := coalesce(new.published_at, now());
    end if;
  else
    -- Una oportunidad solo se crea como borrador o publicada (nunca cerrada/
    -- cubierta/cancelada) y sin moderación previa salvo admin.
    if new.status not in ('draft', 'published') then
      raise exception 'una oportunidad solo puede crearse como borrador o publicada';
    end if;
    if new.moderation_status is distinct from 'unreviewed'
       and not public.is_platform_admin() then
      raise exception 'la moderación solo puede gestionarla un administrador';
    end if;
    if new.status = 'published' then
      new.published_at := coalesce(new.published_at, now());
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 6. Sync oportunidad → post (SECURITY DEFINER: el ciclo puede gestionarlo un
--    miembro del proyecto/org o un admin, no solo el creador). Idempotente:
--    INSERT ... ON CONFLICT (opportunity_id) DO UPDATE = exactamente 1 post.
-- ============================================================================
create or replace function public.posts_sync_from_opportunity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- El post asociado se elimina en cascada por la FK; nada que hacer.
    return old;
  end if;

  if new.status = 'published'
     and new.moderation_status is not null
     and new.moderation_status not in ('rejected', 'flagged') then
    insert into public.posts (
      author_id, post_type, opportunity_id, project_id, organization_id,
      visibility, publication_status, published_at
    )
    values (
      new.creator_id, 'opportunity', new.id, new.project_id, new.organization_id,
      new.visibility, 'published', coalesce(new.published_at, now())
    )
    on conflict (opportunity_id) do update set
      author_id = excluded.author_id,
      project_id = excluded.project_id,
      organization_id = excluded.organization_id,
      visibility = excluded.visibility,
      publication_status = 'published',
      published_at = coalesce(excluded.published_at, now());
  else
    update public.posts
    set publication_status = case
          when new.status = 'cancelled' then 'removed'
          when new.moderation_status in ('rejected', 'flagged') then 'removed'
          when new.status in ('closed', 'filled') then 'hidden'
          else 'draft'
        end,
        published_at = null
    where opportunity_id = new.id;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 7. Triggers sobre `opportunities`
-- ============================================================================
drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.handle_updated_at();

drop trigger if exists opportunities_prevent_id_change on public.opportunities;
create trigger opportunities_prevent_id_change
  before update on public.opportunities
  for each row execute function public.prevent_id_change();

drop trigger if exists opportunities_validate_state_change on public.opportunities;
create trigger opportunities_validate_state_change
  before insert or update on public.opportunities
  for each row execute function public.opportunities_validate_state_change();

drop trigger if exists posts_sync_from_opportunity on public.opportunities;
create trigger posts_sync_from_opportunity
  after insert or update or delete on public.opportunities
  for each row execute function public.posts_sync_from_opportunity();

-- ============================================================================
-- 8. Row Level Security — `opportunities`
-- ============================================================================
alter table public.opportunities enable row level security;

-- Lectura pública: SOLO oportunidades distribuibles con visibilidad 'public'.
drop policy if exists "opportunities_select_public" on public.opportunities;
create policy "opportunities_select_public"
  on public.opportunities for select
  using (
    public.opportunity_is_publicly_distributable(
      status, visibility, moderation_status, opportunity_type, ends_at)
      and visibility = 'public'
  );

-- El creador siempre ve sus oportunidades (borradores, privadas, rechazadas...).
drop policy if exists "opportunities_select_own" on public.opportunities;
create policy "opportunities_select_own"
  on public.opportunities for select
  using (auth.uid() = creator_id);

-- Cualquier usuario autenticado lee oportunidades distribuibles de visibilidad
-- registered_users.
drop policy if exists "opportunities_select_registered" on public.opportunities;
create policy "opportunities_select_registered"
  on public.opportunities for select
  to authenticated
  using (
    public.opportunity_is_publicly_distributable(
      status, visibility, moderation_status, opportunity_type, ends_at)
      and visibility = 'registered_users'
  );

-- Solo miembros del proyecto asociado leen oportunidades project_members.
drop policy if exists "opportunities_select_project_members" on public.opportunities;
create policy "opportunities_select_project_members"
  on public.opportunities for select
  to authenticated
  using (
    public.opportunity_is_publicly_distributable(
      status, visibility, moderation_status, opportunity_type, ends_at)
      and visibility = 'project_members'
      and project_id is not null
      and public.is_project_member(project_id)
  );

-- Administradores leen todo (moderación de oportunidades).
drop policy if exists "opportunities_select_admin" on public.opportunities;
create policy "opportunities_select_admin"
  on public.opportunities for select
  to authenticated
  using (public.is_platform_admin());

-- Insert: el creador solo publica como sí mismo y con contexto real (no como
-- proyecto/organización ajena). El estado de moderación inicial lo valida el
-- trigger (unreviewed salvo admin).
drop policy if exists "opportunities_insert_own" on public.opportunities;
create policy "opportunities_insert_own"
  on public.opportunities for insert
  to authenticated
  with check (
    auth.uid() = creator_id
      and (project_id is null or public.is_project_member(project_id))
      and (organization_id is null or public.is_organization_member(organization_id))
  );

-- Update: el creador, un miembro real del proyecto/organización anclado o un
-- admin. USING evalúa la fila anterior; WITH CHECK la nueva (imposible moverse
-- a un contexto ajeno). Sin política DELETE: el ciclo de vida se gestiona por
-- estados (draft/published/closed/filled/cancelled), nunca por borrado directo.
drop policy if exists "opportunities_update_manage" on public.opportunities;
create policy "opportunities_update_manage"
  on public.opportunities for update
  to authenticated
  using (
    auth.uid() = creator_id
      or (project_id is not null and public.is_project_member(project_id))
      or (organization_id is not null and public.is_organization_member(organization_id))
      or public.is_platform_admin()
  )
  with check (
    auth.uid() = creator_id
      or (project_id is not null and public.is_project_member(project_id))
      or (organization_id is not null and public.is_organization_member(organization_id))
      or public.is_platform_admin()
  );

-- ============================================================================
-- 9. Moderación administrativa (patrón exacto de vídeos: SECURITY DEFINER +
--    is_platform_admin() interno; rechaza moderar lo propio)
-- ============================================================================
create or replace function public.admin_approve_opportunity(p_opportunity_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_opportunity_id is null then
    raise exception 'id de oportunidad no válido' using errcode = '22023';
  end if;

  if not public.is_platform_admin() then
    raise exception 'permiso denegado: se requiere rol de administrador'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.opportunities
    where id = p_opportunity_id and creator_id = auth.uid()
  ) then
    raise exception 'un administrador no puede moderar sus propias oportunidades'
      using errcode = '42501';
  end if;

  update public.opportunities
  set moderation_status = 'approved',
      moderation_reason = null,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_opportunity_id;

  if not found then
    raise exception 'no se encontró la oportunidad' using errcode = '22023';
  end if;

  return true;
end;
$$;

create or replace function public.admin_reject_opportunity(p_opportunity_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_opportunity_id is null then
    raise exception 'id de oportunidad no válido' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'el motivo de moderación no puede superar 500 caracteres'
      using errcode = '22023';
  end if;

  if not public.is_platform_admin() then
    raise exception 'permiso denegado: se requiere rol de administrador'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.opportunities
    where id = p_opportunity_id and creator_id = auth.uid()
  ) then
    raise exception 'un administrador no puede moderar sus propias oportunidades'
      using errcode = '42501';
  end if;

  update public.opportunities
  set moderation_status = 'rejected',
      moderation_reason = p_reason,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_opportunity_id;

  if not found then
    raise exception 'no se encontró la oportunidad' using errcode = '22023';
  end if;

  return true;
end;
$$;

create or replace function public.admin_flag_opportunity(p_opportunity_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_opportunity_id is null then
    raise exception 'id de oportunidad no válido' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'el motivo de moderación no puede superar 500 caracteres'
      using errcode = '22023';
  end if;

  if not public.is_platform_admin() then
    raise exception 'permiso denegado: se requiere rol de administrador'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.opportunities
    where id = p_opportunity_id and creator_id = auth.uid()
  ) then
    raise exception 'un administrador no puede moderar sus propias oportunidades'
      using errcode = '42501';
  end if;

  update public.opportunities
  set moderation_status = 'flagged',
      moderation_reason = p_reason,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_opportunity_id;

  if not found then
    raise exception 'no se encontró la oportunidad' using errcode = '22023';
  end if;

  return true;
end;
$$;

-- ============================================================================
-- 10. RPC: search_opportunities
-- ============================================================================
-- Mismo estándar que search_profiles/projects/organizations/videos: SECURITY
-- DEFINER, search_path='', auth.uid() interno (nunca un user_id de entrada),
-- texto de búsqueda con search_normalize (unaccent/trigram) + LIKE parcial +
-- scoring con la misma fórmula (0.60 similarity + 0.25 ts_rank + 0.15 recency),
-- cursor keyset (score DESC, created_at DESC, id DESC) y payload completo sin
-- N+1. Fail-closed: solo oportunidades de proyectos públicos/publicados (o sin
-- proyecto), visibilidad 'public' y distribuibles (un turno terminado sale).
--
-- Filtros: opportunity_type, industry, work_mode, experience_level,
-- first_job_friendly (combinado: flag + no_experience/junior + internship +
-- student_friendly), student_friendly, location (país/región/ciudad/texto) y
-- p_date para turnos: 'today' | 'tomorrow' | 'weekend' | 'YYYY-MM-DD'.
create or replace function public.search_opportunities(
  p_query text default null,
  p_sort text default 'relevance',
  p_opportunity_type text default null,
  p_industry text default null,
  p_work_mode text default null,
  p_experience_level text default null,
  p_first_job_friendly boolean default null,
  p_student_friendly boolean default null,
  p_location text default null,
  p_date text default null,
  p_limit integer default 21,
  p_cursor_score numeric default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  opportunity_id uuid,
  title text,
  description text,
  opportunity_type text,
  employment_type text,
  experience_level text,
  work_mode text,
  industry text,
  country text,
  region text,
  city text,
  location_text text,
  compensation_type text,
  compensation_min numeric,
  compensation_max numeric,
  currency text,
  compensation_period text,
  starts_at timestamptz,
  ends_at timestamptz,
  slots_total integer,
  is_first_job_friendly boolean,
  is_student_friendly boolean,
  project_id uuid,
  project_name text,
  project_slug text,
  project_stage text,
  project_industries text[],
  organization_id uuid,
  organization_name text,
  organization_slug text,
  creator_id uuid,
  creator_full_name text,
  creator_username text,
  creator_avatar_url text,
  created_at timestamptz,
  search_score numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := public.search_normalize(p_query);
  v_type text := nullif(lower(p_opportunity_type), '');
  v_industry text := nullif(p_industry, '');
  v_work_mode text := nullif(lower(p_work_mode), '');
  v_experience text := nullif(lower(p_experience_level), '');
  v_location text := public.search_normalize(p_location);
  v_date text := nullif(p_date, '');
  v_limit integer := greatest(least(coalesce(p_limit, 21), 50), 1);
begin
  return query
    with base as (
      select
        o.id,
        o.title,
        o.description,
        o.opportunity_type,
        o.employment_type,
        o.experience_level,
        o.work_mode,
        o.industry,
        o.country,
        o.region,
        o.city,
        o.location_text,
        o.compensation_type,
        o.compensation_min,
        o.compensation_max,
        o.currency,
        o.compensation_period,
        o.starts_at,
        o.ends_at,
        o.slots_total,
        o.is_first_job_friendly,
        o.is_student_friendly,
        o.project_id,
        pj.name as project_name,
        pj.slug as project_slug,
        pj.stage as project_stage,
        pj.industries as project_industries,
        o.organization_id,
        og.name as organization_name,
        og.slug as organization_slug,
        o.creator_id,
        cr.full_name as creator_full_name,
        cr.username as creator_username,
        cr.avatar_url as creator_avatar_url,
        o.created_at,
        -- Texto de búsqueda: oportunidad + proyecto + organización + ubicación
        -- (no hay columna generada: combina filas de varias tablas).
        public.search_normalize(
          coalesce(o.title, '') || ' ' || coalesce(o.description, '') || ' '
          || coalesce(o.industry, '') || ' '
          || coalesce(pj.name, '') || ' ' || coalesce(pj.tagline, '') || ' '
          || coalesce(og.name, '') || ' '
          || coalesce(o.city, '') || ' ' || coalesce(o.region, '') || ' '
          || coalesce(o.country, '') || ' ' || coalesce(o.location_text, '')
        ) as search_text
      from public.opportunities o
      -- El proyecto solo aporta contexto si es público y publicado; si la
      -- oportunidad cuelga de un proyecto no público, sale del mercado.
      left join public.projects pj on pj.id = o.project_id
        and pj.is_public = true and pj.status = 'published'
      left join public.organizations og on og.id = o.organization_id
        and og.is_public = true
      left join public.profiles cr on cr.id = o.creator_id
      where public.opportunity_is_publicly_distributable(
              o.status, o.visibility, o.moderation_status,
              o.opportunity_type, o.ends_at)
        and o.visibility = 'public'
        and (o.project_id is null or pj.id is not null)
        and (o.organization_id is null or og.id is not null)
        and (v_type is null or o.opportunity_type = v_type)
        and (v_industry is null or o.industry = v_industry)
        and (v_work_mode is null or o.work_mode = v_work_mode)
        and (v_experience is null or o.experience_level = v_experience)
        and (v_location is null or public.search_normalize(
              coalesce(o.country, '') || ' ' || coalesce(o.region, '') || ' '
              || coalesce(o.city, '') || ' ' || coalesce(o.location_text, '')
            ) like '%' || v_location || '%')
        and (p_first_job_friendly is not true
             or o.is_first_job_friendly
             or o.is_student_friendly
             or o.experience_level in ('no_experience', 'junior')
             or o.opportunity_type = 'internship')
        and (p_student_friendly is not true or o.is_student_friendly)
        and (v_date is null
             or (v_date = 'today' and o.starts_at::date = current_date)
             or (v_date = 'tomorrow' and o.starts_at::date = current_date + 1)
             or (v_date = 'weekend' and o.starts_at::date in (
                   current_date + ((6 - extract(dow from current_date))::integer % 7),
                   current_date + ((7 - extract(dow from current_date))::integer % 7)
                 ))
             or (v_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                 and o.starts_at::date = v_date::date))
    ),
    scored as (
      select
        base.*,
        case
          when p_sort = 'recent'
            then round(public.search_recency(base.created_at, now()), 6)
          when v_query is null
            then round(public.search_recency(base.created_at, now()), 6)
          else round((
            0.60 * extensions.similarity(v_query, coalesce(base.search_text, ''))::numeric
            + 0.25 * least(1.0, ts_rank(
                to_tsvector('simple', coalesce(base.search_text, '')),
                plainto_tsquery('simple', v_query)
              )::numeric)
            + 0.15 * public.search_recency(base.created_at, now())
          )::numeric, 6)
        end as search_score
      from base
      where v_query is null
         or base.search_text like '%' || v_query || '%'
    )
    select
      scored.id,
      scored.title,
      scored.description,
      scored.opportunity_type,
      scored.employment_type,
      scored.experience_level,
      scored.work_mode,
      scored.industry,
      scored.country,
      scored.region,
      scored.city,
      scored.location_text,
      scored.compensation_type,
      scored.compensation_min,
      scored.compensation_max,
      scored.currency,
      scored.compensation_period,
      scored.starts_at,
      scored.ends_at,
      scored.slots_total,
      scored.is_first_job_friendly,
      scored.is_student_friendly,
      scored.project_id,
      scored.project_name,
      scored.project_slug,
      scored.project_stage,
      scored.project_industries,
      scored.organization_id,
      scored.organization_name,
      scored.organization_slug,
      scored.creator_id,
      scored.creator_full_name,
      scored.creator_username,
      scored.creator_avatar_url,
      scored.created_at,
      scored.search_score
    from scored
    where p_cursor_created_at is null
       or (scored.search_score, scored.created_at, scored.id)
            < (p_cursor_score, p_cursor_created_at, p_cursor_id)
    order by scored.search_score desc, scored.created_at desc, scored.id desc
    limit v_limit;
end;
$$;

-- ============================================================================
-- 11. Feed "Para ti" / "Siguiendo": se recrean con `post_type = 'video'`.
--     Los posts de oportunidad NO entran todavía en el feed (tarjeta 100%
--     vídeo); su distribución ocurre vía search/explorar/oportunidades.
--     create or replace conserva la ACL previa, pero se re-aplica más abajo.
-- ============================================================================
create or replace function public.get_for_you_feed(
  p_limit integer default 12,
  p_cursor_score numeric default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  post_id uuid,
  post_post_type text,
  post_body text,
  post_created_at timestamptz,
  post_updated_at timestamptz,
  author_id uuid,
  author_full_name text,
  author_username text,
  author_avatar_url text,
  video_id uuid,
  video_title text,
  video_caption text,
  video_thumbnail_path text,
  video_thumbnail_bucket text,
  video_poster_path text,
  video_poster_bucket text,
  video_duration_seconds integer,
  video_width integer,
  video_height integer,
  project_id uuid,
  project_name text,
  project_slug text,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  published_at timestamptz,
  qualified_views bigint,
  plays bigint,
  average_watch_seconds numeric,
  average_progress numeric,
  completion_rate numeric,
  recency_score numeric,
  affinity_score numeric,
  watch_score numeric,
  completion_score numeric,
  views_score numeric,
  exploration_score numeric,
  final_score numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  candidate_posts as (
    select p.*
    from public.posts p
    where p.publication_status = 'published'
      and p.visibility = 'public'
      and p.post_type = 'video'
      and public.post_is_publicly_distributable(
            p.publication_status, p.visibility, p.video_id)
      and not exists (
        select 1 from public.profile_blocks pb
        where auth.uid() is not null
          and (
            (pb.profile_id = auth.uid() and pb.blocked_id = p.author_id)
            or (pb.profile_id = p.author_id and pb.blocked_id = auth.uid())
          )
      )
  ),
  scored as (
    select
      cp.*,
      m.qualified_views,
      m.plays,
      m.average_watch_seconds,
      m.average_progress,
      m.completion_rate,
      0.5 ^ (greatest(extract(epoch from (now() - cp.published_at)), 0)
          / 3600.0 / 168.0) as recency_score,
      least(
        1.0,
        0.6 * case when auth.uid() is not null and exists (
              select 1 from public.profile_follows f
              where f.profile_id = auth.uid() and f.following_id = cp.author_id
            ) then 1.0 else 0.0 end
      + 0.4 * case when auth.uid() is not null and cp.project_id is not null
              and exists (
                select 1 from public.project_follows f
                where f.profile_id = auth.uid() and f.project_id = cp.project_id
              ) then 1.0 else 0.0 end
      + 0.3 * case when auth.uid() is not null and cp.organization_id is not null
              and exists (
                select 1 from public.organization_follows f
                where f.profile_id = auth.uid() and f.organization_id = cp.organization_id
              ) then 1.0 else 0.0 end
      ) as affinity_score,
      (
        (coalesce(m.qualified_views, 0) / (coalesce(m.qualified_views, 0) + 10.0))
        * coalesce(m.average_progress, 0)
        + (10.0 / (coalesce(m.qualified_views, 0) + 10.0)) * 0.5
      ) as watch_score,
      (
        (coalesce(m.qualified_views, 0) / (coalesce(m.qualified_views, 0) + 10.0))
        * coalesce(m.completion_rate, 0)
        + (10.0 / (coalesce(m.qualified_views, 0) + 10.0)) * 0.3
      ) as completion_score,
      least(1.0, ln(1.0 + coalesce(m.qualified_views, 0)) / 10.0) as views_score,
      exp(-ln(1.0 + coalesce(m.qualified_views, 0)) / 20.0) as exploration_score
    from candidate_posts cp
    left join lateral public._video_metrics_aggregate(cp.video_id) m on true
  ),
  ranked as (
    select
      s.*,
      round(
        0.35 * s.recency_score
      + 0.15 * s.affinity_score
      + 0.20 * s.watch_score
      + 0.10 * s.completion_score
      + 0.10 * s.views_score
      + 0.10 * s.exploration_score,
      6
      ) as final_score
    from scored s
  )
  select
    r.id,
    r.post_type,
    r.body,
    r.created_at,
    r.updated_at,
    a.id,
    a.full_name,
    a.username,
    a.avatar_url,
    v.id,
    v.title,
    v.caption,
    v.thumbnail_path,
    v.thumbnail_bucket,
    v.poster_path,
    v.poster_bucket,
    v.duration_seconds,
    v.width,
    v.height,
    pr.id,
    pr.name,
    pr.slug,
    o.id,
    o.name,
    o.slug,
    r.published_at,
    r.qualified_views,
    r.plays,
    r.average_watch_seconds,
    r.average_progress,
    r.completion_rate,
    r.recency_score,
    r.affinity_score,
    r.watch_score,
    r.completion_score,
    r.views_score,
    r.exploration_score,
    r.final_score
  from ranked r
  left join public.profiles a on a.id = r.author_id
  left join public.videos v on v.id = r.video_id
  left join public.projects pr on pr.id = r.project_id
  left join public.organizations o on o.id = r.organization_id
  where p_cursor_score is null
     or (r.final_score < p_cursor_score)
     or (r.final_score = p_cursor_score and r.published_at < p_cursor_published_at)
     or (r.final_score = p_cursor_score and r.published_at = p_cursor_published_at
         and r.id < p_cursor_id)
  order by r.final_score desc, r.published_at desc, r.id desc
  limit greatest(least(coalesce(p_limit, 12), 50), 1);
$$;

create or replace function public.get_following_feed(
  p_limit integer default 12,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  post_id uuid,
  post_post_type text,
  post_body text,
  post_created_at timestamptz,
  post_updated_at timestamptz,
  author_id uuid,
  author_full_name text,
  author_username text,
  author_avatar_url text,
  video_id uuid,
  video_title text,
  video_caption text,
  video_thumbnail_path text,
  video_thumbnail_bucket text,
  video_poster_path text,
  video_poster_bucket text,
  video_duration_seconds integer,
  video_width integer,
  video_height integer,
  project_id uuid,
  project_name text,
  project_slug text,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  published_at timestamptz,
  qualified_views bigint,
  plays bigint,
  average_watch_seconds numeric,
  average_progress numeric,
  completion_rate numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  candidates as (
    select p.*
    from public.posts p
    where p.publication_status = 'published'
      and p.visibility = 'public'
      and p.post_type = 'video'
      and public.post_is_publicly_distributable(
            p.publication_status, p.visibility, p.video_id)
      and auth.uid() is not null
      and (
        exists (
          select 1 from public.profile_follows f
          where f.profile_id = auth.uid() and f.following_id = p.author_id
        )
        or exists (
          select 1 from public.project_follows f
          where f.profile_id = auth.uid() and f.project_id = p.project_id
        )
        or exists (
          select 1 from public.organization_follows f
          where f.profile_id = auth.uid() and f.organization_id = p.organization_id
        )
      )
      and not exists (
        select 1 from public.profile_blocks pb
        where (pb.profile_id = auth.uid() and pb.blocked_id = p.author_id)
           or (pb.profile_id = p.author_id and pb.blocked_id = auth.uid())
      )
  )
  select
    p.id,
    p.post_type,
    p.body,
    p.created_at,
    p.updated_at,
    a.id,
    a.full_name,
    a.username,
    a.avatar_url,
    v.id,
    v.title,
    v.caption,
    v.thumbnail_path,
    v.thumbnail_bucket,
    v.poster_path,
    v.poster_bucket,
    v.duration_seconds,
    v.width,
    v.height,
    pr.id,
    pr.name,
    pr.slug,
    o.id,
    o.name,
    o.slug,
    p.published_at,
    m.qualified_views,
    m.plays,
    m.average_watch_seconds,
    m.average_progress,
    m.completion_rate
  from candidates p
  left join public.profiles a on a.id = p.author_id
  left join public.videos v on v.id = p.video_id
  left join public.projects pr on pr.id = p.project_id
  left join public.organizations o on o.id = p.organization_id
  left join lateral public._video_metrics_aggregate(p.video_id) m on true
  where p_cursor_published_at is null
     or (p.published_at < p_cursor_published_at)
     or (p.published_at = p_cursor_published_at and p.id < p_cursor_id)
  order by p.published_at desc, p.id desc
  limit greatest(least(coalesce(p_limit, 12), 50), 1);
$$;

-- ============================================================================
-- 12. ACL explícita (revoke-first para TODO lo nuevo; nunca default privileges)
-- ============================================================================
grant usage on schema public to anon, authenticated;

-- Tabla `opportunities`: lectura pública, gestión solo authenticated, sin DELETE.
grant select on public.opportunities to anon, authenticated;
grant select, insert, update on public.opportunities to authenticated;

-- `posts.opportunity_id` queda cubierto por los grants de tabla ya existentes
-- (select/insert/update sobre `posts`); no se necesita grant adicional.

-- Predicado usado en RLS: ejecutable por anon/authenticated (patrón de
-- video_is_publicly_distributable).
revoke execute on function public.opportunity_is_publicly_distributable(text, text, text, text, timestamptz) from public;
grant execute on function public.opportunity_is_publicly_distributable(text, text, text, text, timestamptz) to anon, authenticated;

-- Funciones de trigger: no invocables directamente.
revoke execute on function public.opportunities_validate_state_change() from public;
revoke execute on function public.posts_sync_from_opportunity() from public;

-- Moderación: solo authenticated, con is_platform_admin() comprobado DENTRO
-- (fail-closed por ACL y por la función).
revoke execute on function public.admin_approve_opportunity(uuid) from public;
revoke execute on function public.admin_approve_opportunity(uuid) from anon;
revoke execute on function public.admin_approve_opportunity(uuid) from authenticated;
grant execute on function public.admin_approve_opportunity(uuid) to authenticated;

revoke execute on function public.admin_reject_opportunity(uuid, text) from public;
revoke execute on function public.admin_reject_opportunity(uuid, text) from anon;
revoke execute on function public.admin_reject_opportunity(uuid, text) from authenticated;
grant execute on function public.admin_reject_opportunity(uuid, text) to authenticated;

revoke execute on function public.admin_flag_opportunity(uuid, text) from public;
revoke execute on function public.admin_flag_opportunity(uuid, text) from anon;
revoke execute on function public.admin_flag_opportunity(uuid, text) from authenticated;
grant execute on function public.admin_flag_opportunity(uuid, text) to authenticated;

-- Búsqueda del mercado: anon + authenticated (mercado público, como el resto).
revoke execute on function public.search_opportunities(text, text, text, text, text, text, boolean, boolean, text, text, integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.search_opportunities(text, text, text, text, text, text, boolean, boolean, text, text, integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.search_opportunities(text, text, text, text, text, text, boolean, boolean, text, text, integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.search_opportunities(text, text, text, text, text, text, boolean, boolean, text, text, integer, numeric, timestamptz, uuid) to anon, authenticated;

-- Feed (recreado arriba): se re-aplica la ACL previa para que no dependa de la
-- conservación por `create or replace`.
revoke execute on function public.get_for_you_feed(integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.get_for_you_feed(integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.get_for_you_feed(integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.get_for_you_feed(integer, numeric, timestamptz, uuid) to anon, authenticated;

revoke execute on function public.get_following_feed(integer, timestamptz, uuid) from public;
revoke execute on function public.get_following_feed(integer, timestamptz, uuid) from anon;
revoke execute on function public.get_following_feed(integer, timestamptz, uuid) from authenticated;
grant execute on function public.get_following_feed(integer, timestamptz, uuid) to authenticated;

commit;
