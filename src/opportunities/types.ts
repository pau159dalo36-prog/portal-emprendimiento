import type { Database } from "@/types/database.types";

export type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"];

export type OpportunityOwnerRef = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type OpportunityProjectRef = {
  id: string;
  name: string;
  slug: string;
};

export type OpportunityOrganizationRef = {
  id: string;
  name: string;
  slug: string;
};

export type OpportunityWithDetails = OpportunityRow & {
  owner: OpportunityOwnerRef | null;
  project: OpportunityProjectRef | null;
  organization: OpportunityOrganizationRef | null;
};

// Payload mínimo para renderizar una tarjeta de oportunidad (evita arrastrar
// description completa a las listas).
export type OpportunityCardData = {
  id: string;
  slug: string;
  title: string;
  opportunity_type: string;
  employment_type: string | null;
  work_mode: string | null;
  experience_level: string | null;
  industry: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  is_first_job_friendly: boolean;
  is_student_friendly: boolean;
  compensation_type: string | null;
  compensation_min: number | null;
  compensation_max: number | null;
  currency: string | null;
  compensation_period: string | null;
  starts_at: string | null;
  ends_at: string | null;
  slots_total: number | null;
  closes_at: string | null;
  visibility: string;
  status: string;
  moderation_status: string;
  created_at: string;
  published_at: string | null;
  owner: OpportunityOwnerRef | null;
  organization: OpportunityOrganizationRef | null;
  project: OpportunityProjectRef | null;
};
