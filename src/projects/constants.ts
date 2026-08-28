export const PROJECT_STAGES = [
  "idea",
  "validacion",
  "prototipo",
  "lanzamiento",
  "crecimiento",
] as const;

export const PROJECT_STATUSES = ["draft", "published", "archived"] as const;

export const PROJECT_MEMBER_ROLES = [
  "owner",
  "cofounder",
  "admin",
  "contributor",
  "advisor",
] as const;

export const PROJECT_MANAGEABLE_ROLES = ["cofounder", "admin", "contributor", "advisor"] as const;

export const NEED_STATUSES = ["open", "closed", "filled"] as const;

// Tipos de necesidad (FASE 7): member = talento/equipo (comportamiento
// histórico), mentor = busco mentor/experto, tester = busco testers simples
// (el plan completo de pilot users vive en project_pilot_plans).
export const NEED_KINDS = ["member", "mentor", "tester"] as const;
export type NeedKind = (typeof NEED_KINDS)[number];

// Señal de inversión (FASE 7). SOLO señal informativa: sin transacciones ni
// documentos legales. Debe coincidir con projects_funding_stage_check en SQL.
export const FUNDING_STAGES = ["idea", "pre_seed", "seed", "series_a", "growth"] as const;
export type FundingStage = (typeof FUNDING_STAGES)[number];

export const FUNDING_AMOUNT_MAX = 1000000000;

export const PROJECT_LINK_TYPES = [
  "website",
  "github",
  "twitter",
  "linkedin",
  "discord",
  "docs",
  "other",
] as const;

export const MAX_PROJECT_LINKS = 10;
export const MAX_ORGANIZATION_LINKS = 10;
export const MAX_NEEDS = 20;
export const MAX_MEMBERS = 30;
