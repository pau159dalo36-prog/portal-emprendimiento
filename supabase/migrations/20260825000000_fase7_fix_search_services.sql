-- ============================================================================
-- FASE 7 — Corrección de search_services (filtros exactos, no normalizados)
-- ============================================================================
-- Bug detectado en auditoría conductual contra remoto: los filtros de
-- categoría / modalidad / tipo de precio se pasaban por search_normalize(),
-- que sustituye '_' por espacio ('desarrollo_web' → 'desarrollo web'), por lo
-- que jamás igualaban con los valores snake_case almacenados en la columna.
--
-- Corrección: esos tres filtros son enumeraciones exactas (los valores llegan
-- de constantes de la app); solo se recortan espacios, sin unaccent ni
-- normalización. El resto de la función (scoring, cursor, bloqueos,
-- visibilidad) permanece idéntico. Se re-aplica la ACL revoke-first.
-- ============================================================================

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
  v_category text := nullif(btrim(p_category), '');
  v_delivery text := nullif(btrim(p_delivery_mode), '');
  v_pricing text := nullif(btrim(p_pricing_type), '');
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

-- ACL revoke-first (idempotente, patrón FASE 5/6/7)
revoke execute on function public.search_services(text, text, text, text, text, integer, numeric, timestamptz, uuid) from public;
revoke execute on function public.search_services(text, text, text, text, text, integer, numeric, timestamptz, uuid) from anon;
revoke execute on function public.search_services(text, text, text, text, text, integer, numeric, timestamptz, uuid) from authenticated;
grant execute on function public.search_services(text, text, text, text, text, integer, numeric, timestamptz, uuid) to anon, authenticated;
