-- ============================================================================
-- FASE 7 — Servicios profesionales, freelance y guardados de servicios
-- ============================================================================
-- Migración NO destructiva. Añade:
--
--   public.services          Catálogo MVP de servicios publicados por perfiles
--                            (desarrollo web, diseño, marketing, fotografía,
--                            consultoría, mentoría...). NO es un marketplace
--                            tipo Fiverr/Upwork: sin pagos, sin escrow, sin
--                            contratos, sin ratings ni órdenes.
--   public.saved_services    Guardados con FK real (patrón FASE 9).
--   public.search_services   RPC con el estándar de búsqueda de FASE 5/6.
--   admin_approve/reject/flag_service  Moderación post-publicación (patrón
--                            exacto de vídeos/oportunidades).
--
-- Decisiones de diseño:
--
--  * PRICING explícito y acotado (nunca cantidades sin unidad):
--      pricing_type ∈ fixed | hourly | range | negotiable | free
--      - fixed / hourly : price_amount obligatoria (>= 0) + moneda ISO-4217;
--        hourly es "por hora" (semántica en UI), sin min/max.
--      - range          : price_min y price_max obligatorias (min <= max)
--        + moneda; sin amount.
--      - negotiable / free : SIN cantidades NI moneda.
--    No hay pagos: el precio es solo señal informativa.
--
--  * CICLO DE VIDA: draft → published ⇄ paused → archived (terminal).
--    Solo se crea como draft o published; published_at se fija al publicar
--    (constraint lo exige). Sin DELETE: el ciclo se gestiona por estados,
--    igual que oportunidades.
--
--  * MODERACIÓN post-publicación (patrón vídeos/oportunidades):
--    unreviewed | approved | rejected | flagged con auditoría obligatoria
--    (moderated_by/at/reason). Distribuible = unreviewed/approved. Los
--    cambios de moderación exigen administrador distinto del proveedor
--    (verificado dentro del trigger vía is_platform_admin()).
--
--  * VISIBILIDAD: 'public' (incluye anon) o 'registered_users' (solo
--    autenticados). El proveedor siempre ve lo suyo.
--
--  * BÚSQUEDA: mismo estándar que search_profiles/projects/opportunities:
--    texto normalizado con search_normalize (unaccent + trigram), scoring
--    0.60 similarity + 0.25 ts_rank + 0.15 recency, cursor keyset
--    (score DESC, created_at DESC, id DESC), auth.uid() interno, sin N+1 y
--    excluyendo bloqueos en ambas direcciones (el servicio pertenece a un
--    perfil: si hay bloqueo mutuo no se descubre).
--
--  * FEED: los servicios NO entran en Para ti/Siguiendo (decisión FASE 7:
--    distribución inicial vía /servicios, perfil del proveedor, /explorar y
--    search_services). El ranking del feed NO se toca.
--
--  * SEGURIDAD: RLS estricta; ACL revoke-first para TODO lo nuevo (nunca
--    default privileges); funciones de trigger no invocables directamente.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Tabla `services`
-- ============================================================================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  category text not null default 'otros',
  delivery_mode text not null default 'remote',
  pricing_type text not null default 'negotiable',
  price_amount numeric,
  price_min numeric,
  price_max numeric,
  currency text,
  status text not null default 'draft',
  visibility text not null default 'public',
  moderation_status text not null default 'unreviewed',
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  moderation_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint services_title_length check (
    length(btrim(title)) between 3 and 120
  ),
  constraint services_description_length check (
    length(btrim(description)) between 20 and 5000
  ),
  constraint services_category_check check (
    category in (
      'desarrollo_web', 'diseno', 'marketing', 'fotografia_video',
      'consultoria', 'mentoria', 'formacion', 'otros'
    )
  ),
  constraint services_delivery_mode_check check (
    delivery_mode in ('remote', 'on_site', 'hybrid')
  ),
  constraint services_pricing_type_check check (
    pricing_type in ('fixed', 'hourly', 'range', 'negotiable', 'free')
  ),
  constraint services_status_check check (
    status in ('draft', 'published', 'paused', 'archived')
  ),
  constraint services_visibility_check check (
    visibility in ('public', 'registered_users')
  ),
  constraint services_moderation_status_check check (
    moderation_status in ('unreviewed', 'approved', 'rejected', 'flagged')
  ),
  constraint services_moderation_state_check check (
    moderation_status = 'unreviewed' or moderated_at is not null
  ),
  constraint services_moderation_reason_length check (
    moderation_reason is null or length(moderation_reason) <= 500
  ),
  constraint services_currency_check check (
    currency is null or currency ~ '^[A-Z]{3}$'
  ),
  constraint services_amounts_non_negative_check check (
    (price_amount is null or price_amount >= 0)
    and (price_min is null or price_min >= 0)
    and (price_max is null or price_max >= 0)
  ),
  -- Semántica exacta por tipo de precio (ver cabecera).
  constraint services_pricing_shape_check check (
    case pricing_type
      when 'fixed' then
        (price_amount is not null and price_min is null and price_max is null and currency is not null)::int
      when 'hourly' then
        (price_amount is not null and price_min is null and price_max is null and currency is not null)::int
      when 'range' then
        (price_amount is null and price_min is not null and price_max is not null
         and price_min <= price_max and currency is not null)::int
      else (price_amount is null and price_min is null and price_max is null and currency is null)::int
    end = 1
  ),
  constraint services_published_at_check check (
    status <> 'published' or published_at is not null
  )
);

-- ============================================================================
-- 2. Columna generada de búsqueda + índices
-- ============================================================================
alter table public.services
  add column if not exists search_text text
  generated always as (
    public.search_normalize(
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' ||
      coalesce(category, '') || ' ' || coalesce(delivery_mode, '')
    )
  ) stored;

create index if not exists services_search_text_trgm_idx
  on public.services using gin (search_text extensions.gin_trgm_ops);
create index if not exists services_provider_id_idx on public.services (provider_id);
create index if not exists services_category_idx on public.services (category);
create index if not exists services_delivery_mode_idx on public.services (delivery_mode);
create index if not exists services_pricing_type_idx on public.services (pricing_type);
create index if not exists services_status_idx on public.services (status);
create index if not exists services_visibility_idx on public.services (visibility);
create index if not exists services_moderation_status_idx on public.services (moderation_status);
create index if not exists services_published_at_idx on public.services (published_at desc);
create index if not exists services_listing_idx
  on public.services (status, visibility, published_at desc);

-- ============================================================================
-- 3. Predicado canónico de distributividad
-- ============================================================================
create or replace function public.service_is_publicly_distributable(
  p_status text,
  p_moderation_status text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'published'
    and p_moderation_status is not null
    and not (p_moderation_status in ('rejected', 'flagged'));
$$;

-- ============================================================================
-- 4. Trigger de ciclo de vida y validación de estado
-- ============================================================================
create or replace function public.services_validate_state_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.provider_id is distinct from old.provider_id then
      raise exception 'no se puede cambiar el proveedor de un servicio';
    end if;

    -- Moderación exclusivamente administrativa (patrón vídeos/oportunidades).
    if new.moderation_status is distinct from old.moderation_status
       or new.moderated_by is distinct from old.moderated_by
       or new.moderated_at is distinct from old.moderated_at
       or new.moderation_reason is distinct from old.moderation_reason then
      if not public.is_platform_admin() then
        raise exception 'la moderación solo puede gestionarla un administrador';
      end if;
      if new.provider_id = auth.uid() then
        raise exception 'un administrador no puede moderar sus propios servicios';
      end if;
    end if;

    -- Transiciones permitidas: draft→published, published⇄paused,
    -- published/paused→archived. archived es terminal.
    if new.status <> old.status then
      if not (
        (old.status = 'draft' and new.status = 'published')
        or (old.status = 'published' and new.status in ('paused', 'archived'))
        or (old.status = 'paused' and new.status in ('published', 'archived'))
      ) then
        raise exception 'transición de estado no permitida para servicios';
      end if;
    end if;

    -- Al publicar, fijar published_at (la constraint lo exige).
    if new.status = 'published' and old.status is distinct from 'published' then
      new.published_at := coalesce(new.published_at, now());
    end if;
  else
    -- Un servicio solo se crea como borrador o publicado, sin moderación
    -- previa salvo admin.
    if new.status not in ('draft', 'published') then
      raise exception 'un servicio solo puede crearse como borrador o publicado';
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

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.handle_updated_at();

drop trigger if exists services_prevent_id_change on public.services;
create trigger services_prevent_id_change
  before update on public.services
  for each row execute function public.prevent_id_change();

drop trigger if exists services_validate_state_change on public.services;
create trigger services_validate_state_change
  before insert or update on public.services
  for each row execute function public.services_validate_state_change();

-- ============================================================================
-- 5. Row Level Security — `services`
-- ============================================================================
alter table public.services enable row level security;

-- Lectura pública: SOLO servicios distribuibles con visibilidad 'public'
-- (incluye anon).
drop policy if exists "services_select_public" on public.services;
create policy "services_select_public"
  on public.services for select
  using (
    public.service_is_publicly_distributable(status, moderation_status)
      and visibility = 'public'
  );

-- El proveedor siempre ve los suyos (borradores, pausados, archivados...).
drop policy if exists "services_select_own" on public.services;
create policy "services_select_own"
  on public.services for select
  to authenticated
  using (auth.uid() = provider_id);

-- Usuarios autenticados leen distribuibles de visibilidad registered_users.
drop policy if exists "services_select_registered" on public.services;
create policy "services_select_registered"
  on public.services for select
  to authenticated
  using (
    public.service_is_publicly_distributable(status, moderation_status)
      and visibility = 'registered_users'
  );

-- Administradores leen todo (moderación de servicios).
drop policy if exists "services_select_admin" on public.services;
create policy "services_select_admin"
  on public.services for select
  to authenticated
  using (public.is_platform_admin());

-- Insert: cada perfil publica como sí mismo.
drop policy if exists "services_insert_own" on public.services;
create policy "services_insert_own"
  on public.services for insert
  to authenticated
  with check (auth.uid() = provider_id);

-- Update: solo el proveedor (o admin, que además es el único que puede tocar
-- moderación según el trigger). Sin política DELETE: ciclo de vida por estados.
drop policy if exists "services_update_own" on public.services;
create policy "services_update_own"
  on public.services for update
  to authenticated
  using (auth.uid() = provider_id or public.is_platform_admin())
  with check (auth.uid() = provider_id or public.is_platform_admin());

-- ============================================================================
-- 6. Guardados de servicios (FK real, patrón FASE 9)
-- ============================================================================
create table if not exists public.saved_services (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_services_pk primary key (profile_id, service_id)
);

create index if not exists saved_services_service_idx on public.saved_services (service_id);

alter table public.saved_services enable row level security;

drop policy if exists "saved_services_select_own" on public.saved_services;
create policy "saved_services_select_own"
  on public.saved_services for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "saved_services_insert_own" on public.saved_services;
create policy "saved_services_insert_own"
  on public.saved_services for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.services s
      where s.id = service_id
        and public.service_is_publicly_distributable(s.status, s.moderation_status)
    )
  );

drop policy if exists "saved_services_delete_own" on public.saved_services;
create policy "saved_services_delete_own"
  on public.saved_services for delete
  to authenticated
  using (auth.uid() = profile_id);

revoke all privileges on table public.saved_services from anon;
revoke all privileges on table public.saved_services from authenticated;
grant select, insert, delete on table public.saved_services to authenticated;

-- ============================================================================
-- 7. Moderación administrativa (patrón exacto vídeos/oportunidades)
-- ============================================================================
create or replace function public.admin_approve_service(p_service_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_service_id is null then
    raise exception 'id de servicio no válido' using errcode = '22023';
  end if;

  if not public.is_platform_admin() then
    raise exception 'permiso denegado: se requiere rol de administrador'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.services
    where id = p_service_id and provider_id = auth.uid()
  ) then
    raise exception 'un administrador no puede moderar sus propios servicios'
      using errcode = '42501';
  end if;

  update public.services
  set moderation_status = 'approved',
      moderation_reason = null,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_service_id;

  if not found then
    raise exception 'no se encontró el servicio' using errcode = '22023';
  end if;

  return true;
end;
$$;

create or replace function public.admin_reject_service(p_service_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_service_id is null then
    raise exception 'id de servicio no válido' using errcode = '22023';
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
    select 1 from public.services
    where id = p_service_id and provider_id = auth.uid()
  ) then
    raise exception 'un administrador no puede moderar sus propios servicios'
      using errcode = '42501';
  end if;

  update public.services
  set moderation_status = 'rejected',
      moderation_reason = p_reason,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_service_id;

  if not found then
    raise exception 'no se encontró el servicio' using errcode = '22023';
  end if;

  return true;
end;
$$;

create or replace function public.admin_flag_service(p_service_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_service_id is null then
    raise exception 'id de servicio no válido' using errcode = '22023';
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
    select 1 from public.services
    where id = p_service_id and provider_id = auth.uid()
  ) then
    raise exception 'un administrador no puede moderar sus propios servicios'
      using errcode = '42501';
  end if;

  update public.services
  set moderation_status = 'flagged',
      moderation_reason = p_reason,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_service_id;

  if not found then
    raise exception 'no se encontró el servicio' using errcode = '22023';
  end if;

  return true;
end;
$$;

-- ============================================================================
-- 8. RPC: search_services
-- ============================================================================
-- Estándar FASE 5/6: SECURITY DEFINER, search_path='', auth.uid() interno,
-- search_normalize + LIKE parcial, scoring 0.60/0.25/0.15, cursor keyset y
-- payload completo sin N+1. Fail-closed: solo servicios publicados y
-- distribuibles; visibilidad 'public' para todos, 'registered_users' solo
-- autenticados; excluye bloqueos en ambas direcciones (servicio ↔ llamante).
create or replace function public.search_services(
  p_query text default null,
  p_sort text default 'relevance',
  p_category text default null,
  p_delivery_mode text default null,
  p_pricing_type text default null,
  p_limit integer default 21,
  p_cursor_score numeric default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  service_id uuid,
  title text,
  description text,
  category text,
  delivery_mode text,
  pricing_type text,
  price_amount numeric,
  price_min numeric,
  price_max numeric,
  currency text,
  provider_id uuid,
  provider_full_name text,
  provider_username text,
  provider_avatar_url text,
  provider_headline text,
  created_at timestamptz,
  search_score numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_query text := public.search_normalize(p_query);
  v_category text := nullif(public.search_normalize(p_category), '');
  v_delivery text := nullif(lower(p_delivery_mode), '');
  v_pricing text := nullif(lower(p_pricing_type), '');
  v_limit integer := greatest(least(coalesce(p_limit, 21), 50), 1);
begin
  return query
    with base as (
      select
        s.id,
        s.title,
        s.description,
        s.category,
        s.delivery_mode,
        s.pricing_type,
        s.price_amount,
        s.price_min,
        s.price_max,
        s.currency,
        s.provider_id,
        p.full_name as provider_full_name,
        p.username as provider_username,
        p.avatar_url as provider_avatar_url,
        p.headline as provider_headline,
        s.created_at,
        s.search_text
      from public.services s
      join public.profiles p on p.id = s.provider_id
      where public.service_is_publicly_distributable(s.status, s.moderation_status)
        and (
          s.visibility = 'public'
          or (s.visibility = 'registered_users' and v_uid is not null)
        )
        and not exists (
          select 1 from public.profile_blocks pb
          where v_uid is not null
            and (
              (pb.profile_id = s.provider_id and pb.blocked_id = v_uid)
              or (pb.profile_id = v_uid and pb.blocked_id = s.provider_id)
            )
        )
        and (v_category is null or s.category = v_category)
        and (v_delivery is null or s.delivery_mode = v_delivery)
        and (v_pricing is null or s.pricing_type = v_pricing)
        and (v_query is null or s.search_text like '%' || v_query || '%')
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
    )
    select
      scored.id,
      scored.title,
      scored.description,
      scored.category,
      scored.delivery_mode,
      scored.pricing_type,
      scored.price_amount,
      scored.price_min,
      scored.price_max,
      scored.currency,
      scored.provider_id,
      scored.provider_full_name,
      scored.provider_username,
      scored.provider_avatar_url,
      scored.provider_headline,
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
-- 9. ACL explícita (revoke-first para TODO lo nuevo; nunca default privileges)
-- ============================================================================
grant usage on schema public to anon, authenticated;

-- Tabla `services`: lectura pública de distribuibles, gestión solo del
-- proveedor (RLS), sin DELETE.
revoke all privileges on table public.services from anon;
revoke all privileges on table public.services from authenticated;
grant select on public.services to anon, authenticated;
grant select, insert, update on public.services to authenticated;

-- Predicado usado en RLS/políticas de guardados: ejecutable por
-- anon/authenticated (patrón opportunity_is_publicly_distributable).
revoke execute on function public.service_is_publicly_distributable(text, text) from public;
revoke execute on function public.service_is_publicly_distributable(text, text) from anon;
revoke execute on function public.service_is_publicly_distributable(text, text) from authenticated;
grant execute on function public.service_is_publicly_distributable(text, text) to anon, authenticated;

-- Funciones de trigger: no invocables directamente.
revoke execute on function public.services_validate_state_change() from public;
revoke execute on function public.services_validate_state_change() from anon;
revoke execute on function public.services_validate_state_change() from authenticated;

-- Moderación: solo authenticated, con is_platform_admin() comprobado DENTRO
-- (fail-closed por ACL y por la función).
revoke execute on function public.admin_approve_service(uuid) from public;
revoke execute on function public.admin_approve_service(uuid) from anon;
revoke execute on function public.admin_approve_service(uuid) from authenticated;
grant execute on function public.admin_approve_service(uuid) to authenticated;

revoke execute on function public.admin_reject_service(uuid, text) from public;
revoke execute on function public.admin_reject_service(uuid, text) from anon;
revoke execute on function public.admin_reject_service(uuid, text) from authenticated;
grant execute on function public.admin_reject_service(uuid, text) to authenticated;

revoke execute on function public.admin_flag_service(uuid, text) from public;
revoke execute on function public.admin_flag_service(uuid, text) from anon;
revoke execute on function public.admin_flag_service(uuid, text) from authenticated;
grant execute on function public.admin_flag_service(uuid, text) to authenticated;

-- Búsqueda de servicios: anon + authenticated (descubrimiento público).
revoke execute on function public.search_services(text, text, text, text, text, integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.search_services(text, text, text, text, text, integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.search_services(text, text, text, text, text, integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.search_services(text, text, text, text, text, integer, numeric, timestamptz, uuid) to anon, authenticated;

commit;
