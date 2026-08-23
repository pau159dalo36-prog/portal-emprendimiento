import type { Database } from "@/types/database.types";

export type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"];

// Campos del formulario de oportunidad. Los selectores vacíos se representan
// como cadena vacía (""), nunca null, para que los <select> no controlados
// funcionen con value="". starts_at/ends_at/closes_at se guardan como ISO
// strings (datetime-local) y se convierten a timestamptz en el schema.
export type OpportunityFormData = {
  title: string;
  description: string;
  opportunity_type: string;
  employment_type: string;
  experience_level: string;
  work_mode: string;
  industry: string;
  country: string;
  region: string;
  city: string;
  location_text: string;
  status: string;
  visibility: string;
  is_first_job_friendly: boolean;
  is_student_friendly: boolean;
  compensation_type: string;
  compensation_min: string;
  compensation_max: string;
  currency: string;
  compensation_period: string;
  starts_at: string;
  ends_at: string;
  slots_total: string;
  closes_at: string;
  project_id: string;
  organization_id: string;
};

export const emptyOpportunityFormData: OpportunityFormData = {
  title: "",
  description: "",
  opportunity_type: "job",
  employment_type: "",
  experience_level: "",
  work_mode: "",
  industry: "",
  country: "",
  region: "",
  city: "",
  location_text: "",
  status: "draft",
  visibility: "public",
  is_first_job_friendly: false,
  is_student_friendly: false,
  compensation_type: "",
  compensation_min: "",
  compensation_max: "",
  currency: "",
  compensation_period: "",
  starts_at: "",
  ends_at: "",
  slots_total: "",
  closes_at: "",
  project_id: "",
  organization_id: "",
};

// Convierte un datetime-local ("YYYY-MM-DDTHH:mm") a ISO-8601 UTC
// ("YYYY-MM-DDTHH:mm:ss.sssZ"). El input <input type="datetime-local"> no
// incluye zona horaria; la interpretamos como hora local del navegador.
export function toIsoDateTime(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function toFormDateTime(isoValue: string | null | undefined): string {
  if (!isoValue) {
    return "";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  // Convierte a hora local y recorta a "YYYY-MM-DDTHH:mm".
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toStringOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

function toNumberOrEmpty(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export function toOpportunityFormData(
  opportunity: OpportunityRow | null,
): OpportunityFormData {
  if (!opportunity) {
    return emptyOpportunityFormData;
  }
  return {
    title: opportunity.title,
    description: opportunity.description,
    opportunity_type: opportunity.opportunity_type,
    employment_type: toStringOrEmpty(opportunity.employment_type),
    experience_level: toStringOrEmpty(opportunity.experience_level),
    work_mode: toStringOrEmpty(opportunity.work_mode),
    industry: toStringOrEmpty(opportunity.industry),
    country: toStringOrEmpty(opportunity.country),
    region: toStringOrEmpty(opportunity.region),
    city: toStringOrEmpty(opportunity.city),
    location_text: toStringOrEmpty(opportunity.location_text),
    status: opportunity.status,
    visibility: opportunity.visibility,
    is_first_job_friendly: opportunity.is_first_job_friendly,
    is_student_friendly: opportunity.is_student_friendly,
    compensation_type: toStringOrEmpty(opportunity.compensation_type),
    compensation_min: toNumberOrEmpty(opportunity.compensation_min),
    compensation_max: toNumberOrEmpty(opportunity.compensation_max),
    currency: toStringOrEmpty(opportunity.currency),
    compensation_period: toStringOrEmpty(opportunity.compensation_period),
    starts_at: toFormDateTime(opportunity.starts_at),
    ends_at: toFormDateTime(opportunity.ends_at),
    slots_total: toNumberOrEmpty(opportunity.slots_total),
    closes_at: toFormDateTime(opportunity.closes_at),
    project_id: toStringOrEmpty(opportunity.project_id),
    organization_id: toStringOrEmpty(opportunity.organization_id),
  };
}
