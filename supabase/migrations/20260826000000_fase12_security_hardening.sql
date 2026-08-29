-- ============================================================================
-- FASE 12 — Hardening de seguridad global
-- ============================================================================
-- Objetivo: mínimo privilegio efectivo en toda la base de datos, cerrar los
-- grants residuales de FASE 1/2 (TRUNCATE/REFERENCES/TRIGGER/DELETE/INSERT/
-- UPDATE expuestos a anon/authenticated), delimitar columnas de `profiles`
-- (contact_email, timezone, search_text, onboarding_completed NO públicas),
-- revocar EXECUTE de funciones trigger (solo corren internamente), filtrar
-- bloqueos bidireccionales en todas las búsquedas públicas y añadir los dos
-- mecanismos anti-abuso: reportes de contenido + rate limits.
--
-- Reglas seguidas:
--  * Revoke-first, idempotente: `revoke all` antes de conceder lo mínimo.
--  * anon y authenticated solo reciben lo que el cliente realmente usa
--    (las acciones de lectura/escritura de otros roles corren por RPC
--    SECURITY DEFINER con search_path='' y auth.uid() interno).
--  * Funciones SECURITY DEFINER con `set search_path = ''` y escalado solo
--    cuando es imprescindible; el resto se mantiene INVOKER.
--  * Ninguna tabla nueva se expone a anon si no hace falta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ACL de tablas: revoke-first + concesión mínima
-- ----------------------------------------------------------------------------
-- Protección frente a los grants heredados de FASE 1/2. En particular se
-- elimina TRUNCATE/REFERENCES/TRIGGER/DELETE/INSERT/UPDATE residuales en
-- tablas de contenido y en tablas de referencia (skills, etc.) para anon.
-- La matriz final refleja el uso real del cliente (verificado en auditoría):
--   anon:  solo SELECT mínimo donde hay página pública.
--   auth:  SELECT + DML según lo que ejecutan las server actions (con RLS).
-- ============================================================================

-- --- Tablas SIN acceso para anon (solo authenticated, según su uso) ---
revoke all privileges on table public.applications from public;
revoke all privileges on table public.applications from anon;
revoke all privileges on table public.applications from authenticated;
grant select, insert, update on table public.applications to authenticated;

revoke all privileges on table public.conversations from public;
revoke all privileges on table public.conversations from anon;
revoke all privileges on table public.conversations from authenticated;
grant select on table public.conversations to authenticated;

revoke all privileges on table public.conversation_members from public;
revoke all privileges on table public.conversation_members from anon;
revoke all privileges on table public.conversation_members from authenticated;
grant select, update on table public.conversation_members to authenticated;

revoke all privileges on table public.messages from public;
revoke all privileges on table public.messages from anon;
revoke all privileges on table public.messages from authenticated;
grant select, insert, update on table public.messages to authenticated;

revoke all privileges on table public.notifications from public;
revoke all privileges on table public.notifications from anon;
revoke all privileges on table public.notifications from authenticated;
grant select, update on table public.notifications to authenticated;

revoke all privileges on table public.organization_follows from public;
revoke all privileges on table public.organization_follows from anon;
revoke all privileges on table public.organization_follows from authenticated;
grant select, insert, delete on table public.organization_follows to authenticated;

revoke all privileges on table public.project_follows from public;
revoke all privileges on table public.project_follows from anon;
revoke all privileges on table public.project_follows from authenticated;
grant select, insert, delete on table public.project_follows to authenticated;

revoke all privileges on table public.post_reactions from public;
revoke all privileges on table public.post_reactions from anon;
revoke all privileges on table public.post_reactions from authenticated;
grant select, insert, delete on table public.post_reactions to authenticated;

revoke all privileges on table public.profile_blocks from public;
revoke all privileges on table public.profile_blocks from anon;
revoke all privileges on table public.profile_blocks from authenticated;
grant select, insert, delete on table public.profile_blocks to authenticated;

revoke all privileges on table public.profile_follows from public;
revoke all privileges on table public.profile_follows from anon;
revoke all privileges on table public.profile_follows from authenticated;
grant select, insert, delete on table public.profile_follows to authenticated;

revoke all privileges on table public.project_feedback from public;
revoke all privileges on table public.project_feedback from anon;
revoke all privileges on table public.project_feedback from authenticated;
grant select, insert, update, delete on table public.project_feedback to authenticated;

revoke all privileges on table public.saved_opportunities from public;
revoke all privileges on table public.saved_opportunities from anon;
revoke all privileges on table public.saved_opportunities from authenticated;
grant select, insert, delete on table public.saved_opportunities to authenticated;

revoke all privileges on table public.saved_posts from public;
revoke all privileges on table public.saved_posts from anon;
revoke all privileges on table public.saved_posts from authenticated;
grant select, insert, delete on table public.saved_posts to authenticated;

revoke all privileges on table public.saved_projects from public;
revoke all privileges on table public.saved_projects from anon;
revoke all privileges on table public.saved_projects from authenticated;
grant select, insert, delete on table public.saved_projects to authenticated;

revoke all privileges on table public.saved_services from public;
revoke all privileges on table public.saved_services from anon;
revoke all privileges on table public.saved_services from authenticated;
grant select, insert, delete on table public.saved_services to authenticated;

-- Tablas de detalle de perfil dormidas: sin lectura pública (el perfil público
-- solo lee profile_skills/profile_interests). Con acceso completo para
-- authenticated vía RLS propia; anon NO ve nada.
revoke all privileges on table public.profile_achievements from public;
revoke all privileges on table public.profile_achievements from anon;
revoke all privileges on table public.profile_achievements from authenticated;
grant select, insert, update, delete on table public.profile_achievements to authenticated;

revoke all privileges on table public.profile_education from public;
revoke all privileges on table public.profile_education from anon;
revoke all privileges on table public.profile_education from authenticated;
grant select, insert, update, delete on table public.profile_education to authenticated;

revoke all privileges on table public.profile_experience from public;
revoke all privileges on table public.profile_experience from anon;
revoke all privileges on table public.profile_experience from authenticated;
grant select, insert, update, delete on table public.profile_experience to authenticated;

revoke all privileges on table public.profile_languages from public;
revoke all privileges on table public.profile_languages from anon;
revoke all privileges on table public.profile_languages from authenticated;
grant select, insert, update, delete on table public.profile_languages to authenticated;

revoke all privileges on table public.profile_links from public;
revoke all privileges on table public.profile_links from anon;
revoke all privileges on table public.profile_links from authenticated;
grant select, insert, update, delete on table public.profile_links to authenticated;

revoke all privileges on table public.profile_preferences from public;
revoke all privileges on table public.profile_preferences from anon;
revoke all privileges on table public.profile_preferences from authenticated;
grant select, insert, update, delete on table public.profile_preferences to authenticated;

-- --- Tablas con lectura pública mínima (página pública) ---
revoke all privileges on table public.opportunities from public;
revoke all privileges on table public.opportunities from anon;
revoke all privileges on table public.opportunities from authenticated;
grant select on table public.opportunities to anon;
grant select, insert, update on table public.opportunities to authenticated;

revoke all privileges on table public.organization_links from public;
revoke all privileges on table public.organization_links from anon;
revoke all privileges on table public.organization_links from authenticated;
grant select on table public.organization_links to anon;
grant select, insert, update, delete on table public.organization_links to authenticated;

revoke all privileges on table public.organization_members from public;
revoke all privileges on table public.organization_members from anon;
revoke all privileges on table public.organization_members from authenticated;
grant select on table public.organization_members to anon;
grant select, insert, update, delete on table public.organization_members to authenticated;

revoke all privileges on table public.organizations from public;
revoke all privileges on table public.organizations from anon;
revoke all privileges on table public.organizations from authenticated;
grant select on table public.organizations to anon;
grant select, insert, update on table public.organizations to authenticated;

revoke all privileges on table public.post_comments from public;
revoke all privileges on table public.post_comments from anon;
revoke all privileges on table public.post_comments from authenticated;
grant select on table public.post_comments to anon;
grant select, insert, update, delete on table public.post_comments to authenticated;

revoke all privileges on table public.posts from public;
revoke all privileges on table public.posts from anon;
revoke all privileges on table public.posts from authenticated;
grant select on table public.posts to anon;
grant select, insert, update on table public.posts to authenticated;

revoke all privileges on table public.project_links from public;
revoke all privileges on table public.project_links from anon;
revoke all privileges on table public.project_links from authenticated;
grant select on table public.project_links to anon;
grant select, insert, update, delete on table public.project_links to authenticated;

revoke all privileges on table public.project_members from public;
revoke all privileges on table public.project_members from anon;
revoke all privileges on table public.project_members from authenticated;
grant select on table public.project_members to anon;
grant select, insert, update, delete on table public.project_members to authenticated;

revoke all privileges on table public.project_needs from public;
revoke all privileges on table public.project_needs from anon;
revoke all privileges on table public.project_needs from authenticated;
grant select on table public.project_needs to anon;
grant select, insert, update, delete on table public.project_needs to authenticated;

revoke all privileges on table public.project_pilot_plans from public;
revoke all privileges on table public.project_pilot_plans from anon;
revoke all privileges on table public.project_pilot_plans from authenticated;
grant select on table public.project_pilot_plans to anon;
grant select, insert, update, delete on table public.project_pilot_plans to authenticated;

revoke all privileges on table public.projects from public;
revoke all privileges on table public.projects from anon;
revoke all privileges on table public.projects from authenticated;
grant select on table public.projects to anon;
grant select, insert, update on table public.projects to authenticated;

revoke all privileges on table public.services from public;
revoke all privileges on table public.services from anon;
revoke all privileges on table public.services from authenticated;
grant select on table public.services to anon;
grant select, insert, update on table public.services to authenticated;

revoke all privileges on table public.videos from public;
revoke all privileges on table public.videos from anon;
revoke all privileges on table public.videos from authenticated;
grant select on table public.videos to anon;
grant select, insert, update, delete on table public.videos to authenticated;

-- Tablas de referencia: lectura pública; escritura solo por SQL/admin.
revoke all privileges on table public.professional_roles from public;
revoke all privileges on table public.professional_roles from anon;
revoke all privileges on table public.professional_roles from authenticated;
grant select on table public.professional_roles to anon;
grant select on table public.professional_roles to authenticated;

revoke all privileges on table public.skills from public;
revoke all privileges on table public.skills from anon;
revoke all privileges on table public.skills from authenticated;
grant select on table public.skills to anon;
grant select on table public.skills to authenticated;

revoke all privileges on table public.video_languages from public;
revoke all privileges on table public.video_languages from anon;
revoke all privileges on table public.video_languages from authenticated;
grant select on table public.video_languages to anon;
grant select on table public.video_languages to authenticated;

-- Tablas del perfil público: lectura pública SOLO de las columnas mostradas.
revoke all privileges on table public.profile_interests from public;
revoke all privileges on table public.profile_interests from anon;
revoke all privileges on table public.profile_interests from authenticated;
grant select on table public.profile_interests to anon;
grant select, insert, update, delete on table public.profile_interests to authenticated;

revoke all privileges on table public.profile_skills from public;
revoke all privileges on table public.profile_skills from anon;
revoke all privileges on table public.profile_skills from authenticated;
grant select on table public.profile_skills to anon;
grant select, insert, update, delete on table public.profile_skills to authenticated;

-- ============================================================================
-- 2. profiles: column grants + RPC get_own_profile()
-- ============================================================================
-- Diagnóstico FASE 12 (P1): `profiles_select_public` exponía TODAS las
-- columnas de un perfil público, incluyendo contact_email, timezone,
-- search_text y onboarding_completed. Solución en capas:
--   * anon/auth: SOLO SELECT a nivel de columna sobre las columnas públicas.
--   * El propietario lee SU perfil completo vía RPC SECURITY DEFINER
--     get_own_profile() (internamente guardado con auth.uid()).
--   * UPDATE propio sigue con RLS profiles_update_own sobre todas las columnas
--     (el dueño edita sus propios datos, incluidos contact_email/timezone).
--   * INSERT propio NO se concede: la creación corre por handle_new_user()
--     (SECURITY DEFINER) y no hay policy de INSERT en profiles.
-- ============================================================================
revoke all privileges on table public.profiles from public;
revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;

grant select (
  id, username, full_name, headline, bio, avatar_url, location,
  user_types, weekly_availability, collaboration_preferences,
  website_url, linkedin_url, is_public, created_at, updated_at
) on table public.profiles to anon;

grant select (
  id, username, full_name, headline, bio, avatar_url, location,
  user_types, weekly_availability, collaboration_preferences,
  website_url, linkedin_url, is_public, created_at, updated_at
) on table public.profiles to authenticated;

grant update (
  username, full_name, headline, bio, avatar_url, location,
  user_types, weekly_availability, collaboration_preferences,
  website_url, linkedin_url, is_public, onboarding_completed,
  contact_email, timezone
) on table public.profiles to authenticated;

-- RPC de propietario: devuelve el perfil completo (incluida la parte privada).
-- SOLO para authenticated y fail-closed (sin fila si no es el propietario).
create or replace function public.get_own_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.get_own_profile() from public;
revoke execute on function public.get_own_profile() from anon;
grant execute on function public.get_own_profile() to authenticated;

-- ============================================================================
-- 3. REVOKE EXECUTE de funciones trigger (FASE 1-4)
-- ============================================================================
-- Las funciones de trigger corren internamente al dispararse; exponerlas por
-- PostgREST no aporta funcionalidad y amplia superficie. Se revoca de
-- public/anon/authenticated (patrón ya aplicado en FASE 4.3/5/6/9).
-- ============================================================================
revoke all privileges on function public.handle_new_user() from public, anon, authenticated;
revoke all privileges on function public.handle_updated_at() from public, anon, authenticated;
revoke all privileges on function public.normalize_profile_username() from public, anon, authenticated;
revoke all privileges on function public.normalize_slug() from public, anon, authenticated;
revoke all privileges on function public.profiles_prevent_id_change() from public, anon, authenticated;
revoke all privileges on function public.prevent_id_change() from public, anon, authenticated;
revoke all privileges on function public.organizations_add_owner_member() from public, anon, authenticated;
revoke all privileges on function public.projects_add_owner_member() from public, anon, authenticated;
revoke all privileges on function public.profile_follows_check() from public, anon, authenticated;
revoke all privileges on function public.project_follows_check() from public, anon, authenticated;
revoke all privileges on function public.organization_follows_check() from public, anon, authenticated;
revoke all privileges on function public.profile_blocks_cleanup_follows() from public, anon, authenticated;
revoke all privileges on function public.posts_validate_video_ownership() from public, anon, authenticated;
revoke all privileges on function public.posts_prevent_video_change() from public, anon, authenticated;
revoke all privileges on function public.posts_sync_from_video() from public, anon, authenticated;
revoke all privileges on function public.videos_sync_published_at() from public, anon, authenticated;
revoke all privileges on function public.videos_validate_state_change() from public, anon, authenticated;
revoke all privileges on function public.videos_validate_thumbnail_visibility() from public, anon, authenticated;
revoke all privileges on function public.videos_validate_visibility_bucket() from public, anon, authenticated;

-- ============================================================================
-- 4. Búsquedas públicas: filtro bidireccional de bloqueos
-- ============================================================================
-- search_services/search_profiles ya lo aplicaban; faltaba en vídeos,
-- proyectos, organizaciones y oportunidades. Se replica el mismo predicado:
--   not exists(profile_blocks) entre v_uid (auth.uid()) y el dueño/provider.
-- Funciones SECURITY DEFINER con search_path='' y auth.uid() interno
-- (nunca se acepta un user_id de entrada). Se re-aplica la ACL revoke-first.
-- ============================================================================

-- --- 4.1 search_projects ---
create or replace function public.search_projects(
  p_query text default null,
  p_sort text default 'relevance',
  p_stage text default null,
  p_industry text default null,
  p_limit integer default 21,
  p_cursor_score numeric default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  project_id uuid,
  name text,
  tagline text,
  description text,
  slug text,
  cover_image_url text,
  stage text,
  industries text[],
  owner_id uuid,
  owner_full_name text,
  owner_username text,
  owner_avatar_url text,
  organization_id uuid,
  organization_name text,
  organization_slug text,
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
  v_stage text := nullif(public.search_normalize(p_stage), '');
  v_industry text := nullif(public.search_normalize(p_industry), '');
  v_limit integer := greatest(least(coalesce(p_limit, 21), 50), 1);
begin
  return query
    with base as (
      select
        p.id,
        p.name,
        p.tagline,
        p.description,
        p.slug,
        p.cover_image_url,
        p.stage,
        p.industries,
        p.owner_id,
        o.full_name as owner_full_name,
        o.username as owner_username,
        o.avatar_url as owner_avatar_url,
        og.id as organization_id,
        og.name as organization_name,
        og.slug as organization_slug,
        p.created_at,
        p.search_text
      from public.projects p
      left join public.profiles o on o.id = p.owner_id
      left join public.organizations og on og.id = p.organization_id
      where p.is_public = true
        and p.status = 'published'
        and not exists (
          select 1 from public.profile_blocks pb
          where v_uid is not null
            and (
              (pb.profile_id = p.owner_id and pb.blocked_id = v_uid)
              or (pb.profile_id = v_uid and pb.blocked_id = p.owner_id)
            )
        )
        and (v_stage is null or p.stage = v_stage)
        and (v_industry is null or v_industry = any(p.industries))
        and (v_query is null or p.search_text like '%' || v_query || '%')
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
      scored.name,
      scored.tagline,
      scored.description,
      scored.slug,
      scored.cover_image_url,
      scored.stage,
      scored.industries,
      scored.owner_id,
      scored.owner_full_name,
      scored.owner_username,
      scored.owner_avatar_url,
      scored.organization_id,
      scored.organization_name,
      scored.organization_slug,
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

-- --- 4.2 search_organizations ---
create or replace function public.search_organizations(
  p_query text default null,
  p_sort text default 'relevance',
  p_industry text default null,
  p_limit integer default 21,
  p_cursor_score numeric default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  organization_id uuid,
  name text,
  headline text,
  description text,
  slug text,
  logo_url text,
  location text,
  industries text[],
  owner_id uuid,
  owner_full_name text,
  owner_username text,
  owner_avatar_url text,
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
  v_industry text := nullif(public.search_normalize(p_industry), '');
  v_limit integer := greatest(least(coalesce(p_limit, 21), 50), 1);
begin
  return query
    with base as (
      select
        o.id,
        o.name,
        o.headline,
        o.description,
        o.slug,
        o.logo_url,
        o.location,
        o.industries,
        o.owner_id,
        p.full_name as owner_full_name,
        p.username as owner_username,
        p.avatar_url as owner_avatar_url,
        o.created_at,
        o.search_text
      from public.organizations o
      left join public.profiles p on p.id = o.owner_id
      where o.is_public = true
        and not exists (
          select 1 from public.profile_blocks pb
          where v_uid is not null
            and (
              (pb.profile_id = o.owner_id and pb.blocked_id = v_uid)
              or (pb.profile_id = v_uid and pb.blocked_id = o.owner_id)
            )
        )
        and (v_industry is null or v_industry = any(o.industries))
        and (v_query is null or o.search_text like '%' || v_query || '%')
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
      scored.name,
      scored.headline,
      scored.description,
      scored.slug,
      scored.logo_url,
      scored.location,
      scored.industries,
      scored.owner_id,
      scored.owner_full_name,
      scored.owner_username,
      scored.owner_avatar_url,
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

-- --- 4.3 search_videos ---
create or replace function public.search_videos(
  p_query text default null,
  p_sort text default 'relevance',
  p_language text default null,
  p_limit integer default 21,
  p_cursor_score numeric default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  video_id uuid,
  title text,
  caption text,
  thumbnail_path text,
  thumbnail_bucket text,
  poster_path text,
  poster_bucket text,
  duration_seconds integer,
  width integer,
  height integer,
  owner_id uuid,
  owner_full_name text,
  owner_username text,
  owner_avatar_url text,
  project_id uuid,
  project_name text,
  project_slug text,
  organization_id uuid,
  organization_name text,
  organization_slug text,
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
  v_lang text := nullif(lower(p_language), '');
  v_limit integer := greatest(least(coalesce(p_limit, 21), 50), 1);
begin
  return query
    with base as (
      select
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
        v.owner_id,
        o.full_name as owner_full_name,
        o.username as owner_username,
        o.avatar_url as owner_avatar_url,
        v.project_id,
        pj.name as project_name,
        pj.slug as project_slug,
        v.organization_id,
        og.name as organization_name,
        og.slug as organization_slug,
        v.created_at,
        v.search_text,
        coalesce(
          (select sum(s.plays) from public.video_view_sessions s
           where s.video_id = v.id),
          0
        ) as s_plays
      from public.videos v
      left join public.profiles o on o.id = v.owner_id
      left join public.projects pj on pj.id = v.project_id
      left join public.organizations og on og.id = v.organization_id
      where v.status = 'published'
        and v.processing_status = 'ready'
        and public.video_is_publicly_distributable(v.moderation_status)
        and (
          v.visibility = 'public'
          or (v.visibility = 'registered_users' and v_uid is not null)
          or (v.visibility = 'project_members'
              and v.project_id is not null
              and public.is_project_member(v.project_id))
          or v.owner_id = v_uid
        )
        and not exists (
          select 1 from public.profile_blocks pb
          where v_uid is not null
            and (
              (pb.profile_id = v.owner_id and pb.blocked_id = v_uid)
              or (pb.profile_id = v_uid and pb.blocked_id = v.owner_id)
            )
        )
        and (v_lang is null or v.original_language = v_lang)
        and (v_query is null or v.search_text like '%' || v_query || '%')
    ),
    scored as (
      select
        base.*,
        case
          when p_sort = 'recent'
            then round(public.search_recency(base.created_at, now()), 6)
          when v_query is null
            then round((
              0.85 * public.search_recency(base.created_at, now())
              + 0.15 * least(1.0,
                  ln((1 + base.s_plays)::numeric) / ln(101::numeric))
            )::numeric, 6)
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
      scored.caption,
      scored.thumbnail_path,
      scored.thumbnail_bucket,
      scored.poster_path,
      scored.poster_bucket,
      scored.duration_seconds,
      scored.width,
      scored.height,
      scored.owner_id,
      scored.owner_full_name,
      scored.owner_username,
      scored.owner_avatar_url,
      scored.project_id,
      scored.project_name,
      scored.project_slug,
      scored.organization_id,
      scored.organization_name,
      scored.organization_slug,
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

-- --- 4.4 search_opportunities ---
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
  v_uid uuid := auth.uid();
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
        and not exists (
          select 1 from public.profile_blocks pb
          where v_uid is not null
            and (
              (pb.profile_id = o.creator_id and pb.blocked_id = v_uid)
              or (pb.profile_id = v_uid and pb.blocked_id = o.creator_id)
            )
        )
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

-- ACL revoke-first de las RPC de búsqueda (patrón FASE 5/6/7)
revoke execute on function public.search_projects(text, text, text, text, integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.search_projects(text, text, text, text, integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.search_projects(text, text, text, text, integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.search_projects(text, text, text, text, integer, numeric, timestamptz, uuid) to anon, authenticated;

revoke execute on function public.search_organizations(text, text, text, integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.search_organizations(text, text, text, integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.search_organizations(text, text, text, integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.search_organizations(text, text, text, integer, numeric, timestamptz, uuid) to anon, authenticated;

revoke execute on function public.search_videos(text, text, text, integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.search_videos(text, text, text, integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.search_videos(text, text, text, integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.search_videos(text, text, text, integer, numeric, timestamptz, uuid) to anon, authenticated;

revoke execute on function public.search_opportunities(text, text, text, text, text, text, boolean, boolean, text, text, integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.search_opportunities(text, text, text, text, text, text, boolean, boolean, text, text, integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.search_opportunities(text, text, text, text, text, text, boolean, boolean, text, text, integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.search_opportunities(text, text, text, text, text, text, boolean, boolean, text, text, integer, numeric, timestamptz, uuid) to anon, authenticated;

-- ============================================================================
-- 5. content_reports: sistema mínimo de reportes
-- ============================================================================
-- Tabla + RLS + RPC de resolución para admin. Dedup: un usuario no puede
-- reabrir un reporte sobre el mismo destino (índice parcial único).
-- ============================================================================
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  note text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text,
  constraint content_reports_target_type_check
    check (target_type in ('post','video','service','opportunity','project','organization','comment','profile')),
  constraint content_reports_reason_check
    check (reason in ('spam','inappropriate','misinformation','harassment','impersonation','other')),
  constraint content_reports_status_check
    check (status in ('open','resolved','dismissed'))
);

create index if not exists content_reports_status_idx
  on public.content_reports (status);
create index if not exists content_reports_target_idx
  on public.content_reports (target_type, target_id);
create unique index if not exists content_reports_open_unique_idx
  on public.content_reports (reporter_id, target_type, target_id)
  where status = 'open';

alter table public.content_reports enable row level security;

-- Select: el propio reporter ve sus reportes; el admin ve todos.
drop policy if exists "content_reports_select_own_or_admin" on public.content_reports;
create policy "content_reports_select_own_or_admin"
  on public.content_reports for select
  using (reporter_id = auth.uid() or public.is_platform_admin());

drop policy if exists "content_reports_insert_own" on public.content_reports;
create policy "content_reports_insert_own"
  on public.content_reports for insert
  with check (reporter_id = auth.uid());

drop policy if exists "content_reports_update_admin" on public.content_reports;
create policy "content_reports_update_admin"
  on public.content_reports for update
  using (public.is_platform_admin());

grant select, insert on table public.content_reports to authenticated;
grant update on table public.content_reports to authenticated;

-- RPC de resolución (solo admin; SECURITY DEFINER para tocar columnas de admin)
create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_status text,
  p_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'permission denied';
  end if;

  if p_status not in ('resolved', 'dismissed') then
    raise exception 'invalid status: %', p_status;
  end if;

  update public.content_reports
     set status = p_status,
         resolution_note = coalesce(p_resolution_note, resolution_note),
         resolved_at = now(),
         resolved_by = auth.uid()
   where id = p_report_id
     and status = 'open';
end;
$$;

revoke execute on function public.admin_resolve_report(uuid, text, text) from public;
revoke execute on function public.admin_resolve_report(uuid, text, text) from anon;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;

-- ============================================================================
-- 6. rate_limits: contador por ventana para mitigar abuso
-- ============================================================================
-- Acceso SOLO vía RPC SECURITY DEFINER (consume_rate_limit). Sin grants a
-- anon/authenticated sobre la tabla: nada de lectura/escritura directa.
-- Ventanas por bucket (window_start = inicio del bucket de p_window_seconds),
-- sin datos personales: scope/scope_key son emitidos por el cliente bajo
-- nuestro control (IP hasheada o user id).
-- ============================================================================
create table if not exists public.rate_limits (
  scope text not null,
  scope_key text not null,
  window_start timestamptz not null,
  counter integer not null default 1 check (counter > 0),
  primary key (scope, scope_key, window_start)
);

create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

-- RPC: consume una unidad del límite scope/scope_key. Devuelve true si la
-- llamada queda dentro del máximo, false si se supera el límite en la ventana.
create or replace function public.consume_rate_limit(
  p_scope text,
  p_scope_key text,
  p_max integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_key text := coalesce(p_scope_key, '');
  v_counter integer;
  v_inserted integer;
begin
  if p_scope is null or p_max is null or p_max < 1 or p_window_seconds < 1 then
    return false;
  end if;

  update public.rate_limits
     set counter = counter + 1
   where scope = p_scope
     and scope_key = v_key
     and window_start = v_bucket
     and counter < p_max
  returning counter into v_counter;

  if v_counter is not null then
    return true;
  end if;

  insert into public.rate_limits (scope, scope_key, window_start, counter)
  values (p_scope, v_key, v_bucket, 1)
  on conflict (scope, scope_key, window_start) do nothing;

  get diagnostics v_inserted = row_count;

  -- La fila ya existía y está al límite de la ventana.
  return v_inserted > 0;
end;
$$;

revoke execute on function public.consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to anon, authenticated;

-- Limpieza periódica de ventanas viejas (probabilística para no penalizar la
-- RPC; las filas antiguas solo estorban en disco y nunca reabren límites).
do $$
begin
  delete from public.rate_limits
  where window_start < now() - interval '24 hours';
end;
$$;