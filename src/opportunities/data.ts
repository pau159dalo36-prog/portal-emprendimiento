import type { SupabaseClient } from "@supabase/supabase-js";

import { OPPORTUNITY_DISTRIBUTABLE_MODERATION_STATUSES } from "@/opportunities/constants";
import type { OpportunityWithDetails } from "@/opportunities/types";
import type { Database } from "@/types/database.types";

export type ListPublishedOpportunitiesFilters = {
  limit?: number;
  creatorId?: string;
};

const OPPORTUNITY_WITH_DETAILS =
  "*, owner:profiles!opportunities_creator_id_fkey(id, full_name, username, avatar_url), project:projects(id, name, slug), organization:organizations!opportunities_organization_id_fkey(id, name, slug)";

// Predicado distribuible en SQL plano (espejo de opportunity_is_publicly_
// distributable): publicada + moderación no rechazada/marcada + turno no
// terminado. La constraint opportunities_one_day_shift_check garantiza que los
// tipos que no son one_day_shift tienen ends_at NULL, por lo que
// "opportunity_type.neq.one_day_shift OR ends_at.gt.now" es exacto y barato.
function isDistributable(now: Date): string {
  return `opportunity_type.neq.one_day_shift,ends_at.gt.${now.toISOString()}`;
}

export async function listPublishedOpportunities(
  supabase: SupabaseClient<Database>,
  filters: ListPublishedOpportunitiesFilters = {},
): Promise<OpportunityWithDetails[]> {
  let query = supabase
    .from("opportunities")
    .select(OPPORTUNITY_WITH_DETAILS)
    .eq("status", "published")
    .eq("visibility", "public")
    .in("moderation_status", [...OPPORTUNITY_DISTRIBUTABLE_MODERATION_STATUSES])
    .or(isDistributable(new Date()))
    .order("published_at", { ascending: false });

  if (filters.creatorId) {
    query = query.eq("creator_id", filters.creatorId);
  }
  if (filters.limit != null) {
    query = query.limit(filters.limit);
  }

  const { data } = await query;
  return data ?? [];
}

// El detalle depende de RLS: una oportunidad NO visible (borrador ajeno,
// turno terminado, rejected/flagged, visibilidad restringida) devuelve null.
export async function getOpportunityById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<OpportunityWithDetails | null> {
  const { data } = await supabase
    .from("opportunities")
    .select(OPPORTUNITY_WITH_DETAILS)
    .eq("id", id)
    .maybeSingle();

  return data ?? null;
}

export async function listOpportunitiesForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OpportunityWithDetails[]> {
  const { data } = await supabase
    .from("opportunities")
    .select(OPPORTUNITY_WITH_DETAILS)
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

const MODERATION_PRIORITY: Record<string, number> = {
  unreviewed: 0,
  flagged: 1,
  rejected: 2,
  approved: 3,
};

export async function listOpportunitiesForModeration(
  supabase: SupabaseClient<Database>,
): Promise<OpportunityWithDetails[]> {
  const { data } = await supabase
    .from("opportunities")
    .select(OPPORTUNITY_WITH_DETAILS);

  return [...(data ?? [])].sort((a, b) => {
    const priority =
      (MODERATION_PRIORITY[a.moderation_status] ?? 4) -
      (MODERATION_PRIORITY[b.moderation_status] ?? 4);
    if (priority !== 0) {
      return priority;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function listPublishedOpportunitiesForProject(
  supabase: SupabaseClient<Database>,
  projectId: string,
  filters: ListPublishedOpportunitiesFilters = {},
): Promise<OpportunityWithDetails[]> {
  let query = supabase
    .from("opportunities")
    .select(OPPORTUNITY_WITH_DETAILS)
    .eq("project_id", projectId)
    .eq("status", "published")
    .eq("visibility", "public")
    .in("moderation_status", [...OPPORTUNITY_DISTRIBUTABLE_MODERATION_STATUSES])
    .or(isDistributable(new Date()))
    .order("published_at", { ascending: false });

  if (filters.limit != null) {
    query = query.limit(filters.limit);
  }

  const { data } = await query;
  return data ?? [];
}

export async function listPublishedOpportunitiesForOrganization(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: ListPublishedOpportunitiesFilters = {},
): Promise<OpportunityWithDetails[]> {
  let query = supabase
    .from("opportunities")
    .select(OPPORTUNITY_WITH_DETAILS)
    .eq("organization_id", organizationId)
    .eq("status", "published")
    .eq("visibility", "public")
    .in("moderation_status", [...OPPORTUNITY_DISTRIBUTABLE_MODERATION_STATUSES])
    .or(isDistributable(new Date()))
    .order("published_at", { ascending: false });

  if (filters.limit != null) {
    query = query.limit(filters.limit);
  }

  const { data } = await query;
  return data ?? [];
}
