// Constantes del dominio de oportunidades (mercado de trabajo/colaboración).
// Los valores reflejan exactamente los CHECK constraints de la migración
// supabase/migrations/20260817000000_fase6_oportunidades.sql. Cualquier cambio
// aquí debe ir acompañado del CHECK correspondiente en SQL.

export const OPPORTUNITY_TYPES = [
  "job",
  "internship",
  "cofounder",
  "collaboration",
  "one_day_shift",
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

// Solo job/internship admiten employment_type y work_mode (ver
// employment_scope_check en la migración).
export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "freelance",
  "temporary",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORK_MODES = ["on_site", "remote", "hybrid"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const EXPERIENCE_LEVELS = [
  "no_experience",
  "junior",
  "mid",
  "senior",
  "expert",
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const OPPORTUNITY_STATUSES = [
  "draft",
  "published",
  "closed",
  "filled",
  "cancelled",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const OPPORTUNITY_VISIBILITIES = [
  "public",
  "registered_users",
  "project_members",
  "private",
  "unlisted",
] as const;
export type OpportunityVisibility = (typeof OPPORTUNITY_VISIBILITIES)[number];

export const OPPORTUNITY_MODERATION_STATUSES = [
  "unreviewed",
  "approved",
  "flagged",
  "rejected",
] as const;
export type OpportunityModerationStatus =
  (typeof OPPORTUNITY_MODERATION_STATUSES)[number];

// Distribuible = sin revisar o aprobada (rejected/flagged bloquea de inmediato).
export const OPPORTUNITY_DISTRIBUTABLE_MODERATION_STATUSES = [
  "unreviewed",
  "approved",
] as const;

export const OPPORTUNITY_SORTS = ["relevance", "recent"] as const;

export const COMPENSATION_TYPES = [
  "monetary",
  "equity",
  "negotiable",
  "unpaid",
] as const;
export type CompensationType = (typeof COMPENSATION_TYPES)[number];

export const COMPENSATION_PERIODS = [
  "hour",
  "shift",
  "day",
  "week",
  "month",
  "year",
  "one_time",
] as const;
export type CompensationPeriod = (typeof COMPENSATION_PERIODS)[number];

// Compensación monetaria por turnos: solo periodos por hora o por turno
// (ver one_day_compensation_check en la migración).
export const ONE_DAY_COMPENSATION_PERIODS = ["shift", "day"] as const;

// ---------------------------------------------------------------------------
// Límites (deben coincidir con los CHECK de la migración)
// ---------------------------------------------------------------------------
export const OPPORTUNITY_TITLE_MIN_LENGTH = 3;
export const OPPORTUNITY_TITLE_MAX_LENGTH = 200;
export const OPPORTUNITY_DESCRIPTION_MIN_LENGTH = 10;
export const OPPORTUNITY_DESCRIPTION_MAX_LENGTH = 5000;
export const OPPORTUNITY_LOCATION_TEXT_MAX_LENGTH = 200;
export const OPPORTUNITY_SLOTS_MIN = 1;
export const OPPORTUNITY_SLOTS_MAX = 10000;
export const OPPORTUNITY_CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const OPPORTUNITY_MIN_COMPENSATION_MIN = 0;
export const OPPORTUNITY_COMPENSATION_MAX_VALUE = 1000000000;

// ISO-4217: códigos de moneda que ofrece el portal.
export const CURRENCIES = [
  "ARS",
  "BOB",
  "BRL",
  "CLP",
  "COP",
  "CRC",
  "CUP",
  "DOP",
  "EUR",
  "GTQ",
  "HNL",
  "MXN",
  "NIO",
  "PAB",
  "PEN",
  "PYG",
  "USD",
  "UYU",
  "VES",
] as const;

// Países principales de la audiencia (misma lista que organizations).
export const COUNTRIES = [
  "AR",
  "BO",
  "BR",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "ES",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PE",
  "PY",
  "SV",
  "UY",
  "US",
  "VE",
] as const;

export type OpportunityCountry = (typeof COUNTRIES)[number];

export function isOneDayShift(type: string | null | undefined): boolean {
  return type === "one_day_shift";
}

export function isMonetaryCompensation(type: string | null | undefined): boolean {
  return type === "monetary";
}
