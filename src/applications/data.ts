import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApplicationCounts } from "@/applications/types";
import type { MyApplicationListItem, OpportunityApplicationListItem } from "@/applications/types";
import type { Database } from "@/types/database.types";

// Capa de datos de candidaturas (FASE 8). Todas las funciones reciben el
// cliente inyectado (patrón del repo) y delegan la autorización en RLS:
// el applicant solo ve lo suyo; el manager solo las de oportunidades que
// gestiona. Aquí NO se duplican comprobaciones de identidad.

/** Candidatura del usuario actual para una oportunidad (o null). */
export async function getMyApplicationForOpportunity(
  supabase: SupabaseClient<Database>,
  userId: string,
  opportunityId: string,
): Promise<MyApplicationListItem | null> {
  const { data } = await supabase
    .from("applications")
    .select(
      "*, opportunity:opportunities(id, title, opportunity_type, status, city, country, slots_total)",
    )
    .eq("opportunity_id", opportunityId)
    .eq("applicant_id", userId)
    .maybeSingle();

  return data ?? null;
}

/** "Mis candidaturas" para /panel/candidaturas. La oportunidad puede dejar de
 * resolverse (p. ej. pasó a private): esos casos no se muestran. */
export async function listMyApplications(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<MyApplicationListItem[]> {
  const { data } = await supabase
    .from("applications")
    .select(
      "*, opportunity:opportunities(id, title, opportunity_type, status, city, country, slots_total)",
    )
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * Candidatos de UNA oportunidad para su manager. La RLS garantiza que un
 * outsider obtiene cero filas; la página distingue "sin candidatos" de
 * "sin acceso" consultando antes la oportunidad.
 */
export async function listOpportunityApplications(
  supabase: SupabaseClient<Database>,
  opportunityId: string,
): Promise<OpportunityApplicationListItem[]> {
  // Payload público del candidato (nunca datos de contacto ni privados).
  const { data } = await supabase
    .from("applications")
    .select(
      `*,
       applicant:profiles!applications_applicant_id_fkey(
         id, full_name, username, avatar_url, headline, location, user_types
       )`,
    )
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

/** Conteos por agregación (RPC SECURITY DEFINER, fail-closed al perímetro
 * manager). Una sola llamada para N oportunidades: sin N+1. Las ids sin
 * permiso o sin filas simplemente no vuelven. */
export async function getApplicationCounts(
  supabase: SupabaseClient<Database>,
  opportunityIds: string[],
): Promise<Map<string, ApplicationCounts>> {
  if (opportunityIds.length === 0) {
    return new Map();
  }

  const { data } = await supabase.rpc("get_application_counts", {
    p_opportunity_ids: opportunityIds,
  });

  const counts = new Map<string, ApplicationCounts>();
  for (const row of data ?? []) {
    counts.set(row.opportunity_id, {
      total: Number(row.total),
      acceptedCount: Number(row.accepted_count),
    });
  }
  return counts;
}

/** ¿Gestiona el usuario actual esta oportunidad? (RPC espejo del USING de
 * opportunities_update_manage). Para decidir UI en el detalle. */
export async function canManageOpportunity(
  supabase: SupabaseClient<Database>,
  opportunityId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("can_manage_opportunity", {
    p_opportunity_id: opportunityId,
  });
  return data === true;
}
