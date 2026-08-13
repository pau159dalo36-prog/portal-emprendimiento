-- ============================================================================
-- FASE 5 — Búsqueda global (perfiles, proyectos, organizaciones y vídeos)
-- ============================================================================
-- Migración NO destructiva: solo añade extensiones, columnas generadas,
-- índices y cuatro RPCs SECURITY DEFINER (search_profiles, search_projects,
-- search_organizations, search_videos) + su ACL explícita.
--
-- Diseño:
--
--  1. NORMALIZACIÓN CENTRALIZADA. `search_normalize` (INMUTABLE, strict) es la
--     única puerta de entrada del texto: quita acentos (extensions.unaccent),
--     pasa a minúsculas y elimina puntuación. Se usa en las columnas generadas
--     `search_text` de las cuatro tablas (expresión inmutable → permitido) y en
--     las RPCs sobre el parámetro p_query. El cliente (src/search/schemas.ts)
--     solo trunca a 200 caracteres; la BD hace el resto. Al ser la misma
--     función en ambos lados, "José" y "jose" son la misma búsqueda.
--
--  2. RENDIMIENTO. Índices GIN de trigramas (extensions.pg_trgm) sobre
--     `search_text` para soportar `ILIKE '%q%'` sin seq-scan, más índices GIN
--     sobre los arrays de filtro (user_types / industries) y un índice
--     compuesto (profile_id, code) para el filtro por idioma de perfil.
--
--  3. SCORE (redondeado a 6 decimales, orden y cursor estables):
--       - Con query (relevance): 0.60 * similaridad_trigrama
--                                + 0.25 * ts_rank(tsvector 'simple')
--                                + 0.15 * recencia (decay exponencial, 30d)
--       - Sin query (browse):
--           perfiles/proyectos/orgs → recencia
--           vídeos                    → 0.85 * recencia + 0.15 * engagement
--             (engagement = log1p(plays agregados de video_view_sessions) / log1p(100))
--       - sort = 'recent' → recencia pura (orden efectivo por created_at DESC,
--         que es lo que busca la UI; mantiene el mismo cursor).
--     Los componentes son deterministas dentro de una llamada (now() fijo) y
--     acotados a [0,1], por lo que el cursor por tupla no genera duplicados.
--
--  4. PRIVACIDAD (espejo de las políticas RLS existentes, nunca por encima):
--       - Perfiles:      is_public = true  o  propio (auth.uid() = id).
--                        Excluidos los bloqueados en AMBAS direcciones.
--                        is_following se calcula por fila para el llamante.
--       - Proyectos:     is_public = true AND status = 'published'.
--       - Organizaciones: is_public = true.
--       - Vídeos:        status='published' + processing='ready' +
--                        video_is_publicly_distributable(moderation_status) y,
--                        según visibilidad: 'public' para todos;
--                        'registered_users' solo autenticados; 'project_members'
--                        solo miembros del proyecto; propios (owner_id) siempre.
--                        'unlisted' SOLO su propietario (se comparten por enlace,
--                        no se descubren).
--     Las RPCs son SECURITY DEFINER (como get_for_you_feed) para leer las
--     tablas de relaciones/follows/analytics sin políticas, replicando la
--     visibilidad a mano y devolviendo UN SOLO dataset por RPC (sin N+1).
--
--  5. PAGINACIÓN POR CURSOR (nunca OFFSET): tupla (search_score DESC,
--     created_at DESC, id DESC), idéntica para las cuatro entidades. El cursor
--     es opaco para la UI (src/search/schemas.ts lo serializa).
--
--  6. ACL: los cuatro RPCs se conceden a anon y authenticated (búsqueda global
--     de descubrimiento). search_normalize también (lo usan las columnas
--     generadas al escribir con los privilegios del usuario); search_recency
--     NO (solo corre dentro de las RPCs SECURITY DEFINER) y no se expone.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensiones (esquema `extensions`, estándar de Supabase)
-- ---------------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- 2. Helpers de texto y score
-- ---------------------------------------------------------------------------

-- Normaliza texto de búsqueda: unaccent (diccionario explícito → inmutable) +
-- minúsculas + sin puntuación ni espacios redundantes. NULL → NULL (strict).
create or replace function public.search_normalize(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      lower(extensions.unaccent('extensions.unaccent', p_value)),
      '[^a-z0-9]+', ' ', 'g'
    ),
    ''
  );
$$;

-- Convierte un array de etiquetas (user_types / industries) a texto plano.
-- Envuelve array_to_string (STABLE en Postgres ≥16, prohibido en columnas
-- generadas) dentro de una función declarada INMUTABLE: las columnas generadas
-- solo validan las llamadas directas, igual que search_normalize con unaccent.
create or replace function public.search_array_to_text(p_values text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_to_string(p_values, ' '), '');
$$;

-- Recencia en [0,1] con decay exponencial de media-vida ~30 días.
-- 0 días → 1.0, 30 días → 0.5, 60 días → 0.25...
create or replace function public.search_recency(
  p_created_at timestamptz,
  p_ref timestamptz default now()
)
returns numeric
language sql
stable
parallel safe
set search_path = ''
as $$
  select round(
    exp(
      -greatest(0, extract(epoch from (p_ref - p_created_at)))
      / (30.0 * 86400.0)
    )::numeric,
    6
  );
$$;

-- search_normalize y search_array_to_text se ejecutan también en las columnas
-- generadas al ESCRIBIR (INSERT/UPDATE), con los privilegios del usuario
-- escritor: por eso se conceden a anon/authenticated (son transformaciones
-- puras de texto, sin riesgo).
-- search_recency solo se usa dentro de las RPCs SECURITY DEFINER (corren como
-- postgres), así que se mantiene fail-closed y NO se expone por PostgREST.
revoke execute on function public.search_normalize(text) from public;
grant execute on function public.search_normalize(text) to anon, authenticated;

revoke execute on function public.search_array_to_text(text[]) from public;
grant execute on function public.search_array_to_text(text[]) to anon, authenticated;

revoke execute on function public.search_recency(timestamptz, timestamptz) from public;

-- ---------------------------------------------------------------------------
-- 3. Columnas generadas `search_text` (inmutables) + índices
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists search_text text
  generated always as (
    public.search_normalize(
      coalesce(username, '') || ' ' || coalesce(full_name, '') || ' ' ||
      coalesce(headline, '') || ' ' || coalesce(location, '') || ' ' ||
      coalesce(bio, '') || ' ' ||
      public.search_array_to_text(user_types)
    )
  ) stored;

alter table public.projects
  add column if not exists search_text text
  generated always as (
    public.search_normalize(
      coalesce(name, '') || ' ' || coalesce(tagline, '') || ' ' ||
      coalesce(description, '') || ' ' || coalesce(problem, '') || ' ' ||
      coalesce(solution, '') || ' ' || coalesce(target_market, '') || ' ' ||
      coalesce(traction, '') || ' ' || coalesce(stage, '') || ' ' ||
      coalesce(slug, '') || ' ' ||
      public.search_array_to_text(industries)
    )
  ) stored;

alter table public.organizations
  add column if not exists search_text text
  generated always as (
    public.search_normalize(
      coalesce(name, '') || ' ' || coalesce(headline, '') || ' ' ||
      coalesce(description, '') || ' ' || coalesce(location, '') || ' ' ||
      coalesce(slug, '') || ' ' ||
      public.search_array_to_text(industries)
    )
  ) stored;

alter table public.videos
  add column if not exists search_text text
  generated always as (
    public.search_normalize(
      coalesce(title, '') || ' ' || coalesce(caption, '')
    )
  ) stored;

-- GIN de trigramas sobre el texto normalizado (soporta ILIKE '%q%').
create index if not exists profiles_search_text_trgm_idx
  on public.profiles using gin (search_text extensions.gin_trgm_ops);
create index if not exists projects_search_text_trgm_idx
  on public.projects using gin (search_text extensions.gin_trgm_ops);
create index if not exists organizations_search_text_trgm_idx
  on public.organizations using gin (search_text extensions.gin_trgm_ops);
create index if not exists videos_search_text_trgm_idx
  on public.videos using gin (search_text extensions.gin_trgm_ops);

-- Índices para los filtros por array / idioma.
create index if not exists profiles_user_types_gin_idx
  on public.profiles using gin (user_types);
create index if not exists projects_industries_gin_idx
  on public.projects using gin (industries);
create index if not exists organizations_industries_gin_idx
  on public.organizations using gin (industries);
create index if not exists profile_languages_profile_code_idx
  on public.profile_languages (profile_id, code);

-- ---------------------------------------------------------------------------
-- 4. RPC: search_profiles
-- ---------------------------------------------------------------------------
-- Filtros: p_query, p_role (user_types), p_language (profile_languages.code).
-- Solo perfiles públicos o propios, excluyendo bloqueados en ambas direcciones.
create or replace function public.search_profiles(
  p_query text default null,
  p_sort text default 'relevance',
  p_role text default null,
  p_language text default null,
  p_limit integer default 21,
  p_cursor_score numeric default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  profile_id uuid,
  full_name text,
  username text,
  avatar_url text,
  headline text,
  bio text,
  location text,
  user_types text[],
  created_at timestamptz,
  is_following boolean,
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
  v_role text := nullif(public.search_normalize(p_role), '');
  v_lang text := nullif(lower(p_language), '');
  v_limit integer := greatest(least(coalesce(p_limit, 21), 50), 1);
begin
  return query
    with base as (
      select
        p.id,
        p.full_name,
        p.username,
        p.avatar_url,
        p.headline,
        p.bio,
        p.location,
        p.user_types,
        p.created_at,
        p.search_text,
        exists (
          select 1 from public.profile_follows pf
          where pf.profile_id = v_uid and pf.following_id = p.id
        ) as s_following
      from public.profiles p
      where (p.is_public = true or p.id = v_uid)
        and not exists (
          select 1 from public.profile_blocks pb
          where (pb.profile_id = p.id and pb.blocked_id = v_uid)
             or (pb.profile_id = v_uid and pb.blocked_id = p.id)
        )
        and (v_role is null or exists (
          select 1 from unnest(p.user_types) ut where ut = v_role
        ))
        and (v_lang is null or exists (
          select 1 from public.profile_languages pl
          where pl.profile_id = p.id and pl.code = v_lang
        ))
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
      scored.full_name,
      scored.username,
      scored.avatar_url,
      scored.headline,
      scored.bio,
      scored.location,
      scored.user_types,
      scored.created_at,
      scored.s_following,
      scored.search_score
    from scored
    where p_cursor_created_at is null
       or (scored.search_score, scored.created_at, scored.id)
            < (p_cursor_score, p_cursor_created_at, p_cursor_id)
    order by scored.search_score desc, scored.created_at desc, scored.id desc
    limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC: search_projects
-- ---------------------------------------------------------------------------
-- Filtros: p_query, p_stage, p_industry. Solo proyectos publicados y públicos.
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

-- ---------------------------------------------------------------------------
-- 6. RPC: search_organizations
-- ---------------------------------------------------------------------------
-- Filtros: p_query, p_industry. Solo organizaciones públicas.
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

-- ---------------------------------------------------------------------------
-- 7. RPC: search_videos
-- ---------------------------------------------------------------------------
-- Filtros: p_query, p_language (original_language). Solo vídeos distribuibles
-- (published + ready + moderación no rechazada/marcada) y dentro de su
-- visibilidad; 'unlisted' y 'private' solo para su propietario.
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

-- ---------------------------------------------------------------------------
-- 8. ACL explícita (revoca primero, luego concede; idempotente y corrige
--    cualquier grant residual de public/anon/authenticated)
-- ---------------------------------------------------------------------------
revoke execute on function public.search_profiles(text, text, text, text, integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.search_profiles(text, text, text, text, integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.search_profiles(text, text, text, text, integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.search_profiles(text, text, text, text, integer, numeric, timestamptz, uuid) to anon, authenticated;

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
