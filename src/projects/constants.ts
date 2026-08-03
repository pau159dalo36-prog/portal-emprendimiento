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
