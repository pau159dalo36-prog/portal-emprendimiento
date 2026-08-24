import type { Database } from "@/types/database.types";

import type { ApplicationFilter, ApplicationStatus } from "@/applications/config";

export type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

/** Candidatura con los datos públicos de la oportunidad asociada. */
export type MyApplicationListItem = ApplicationRow & {
  opportunity: {
    id: string;
    title: string;
    opportunity_type: string;
    status: string;
    city: string | null;
    country: string | null;
    slots_total: number | null;
  } | null;
};

/** Payload público del candidato para el panel del manager (sin datos privados). */
export type CandidateProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  user_types: string[] | null;
};

/** Candidatura + perfil público del candidato, para el manager. */
export type OpportunityApplicationListItem = ApplicationRow & {
  applicant: CandidateProfile | null;
};

/** Conteos derivados por agregación (RPC get_application_counts). */
export type ApplicationCounts = {
  total: number;
  acceptedCount: number;
};

export function isApplicationFilter(value: string | undefined): value is ApplicationFilter {
  return (
    value === "all" ||
    value === "submitted" ||
    value === "viewed" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "withdrawn"
  );
}

export type { ApplicationFilter, ApplicationStatus };
