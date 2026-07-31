export const USER_TYPES = [
  "emprendedor",
  "colaborador",
  "mentor",
  "profesional",
  "inversor",
  "empresa",
  "institucion",
] as const;

export const USER_TYPE_LABELS: Record<(typeof USER_TYPES)[number], string> = {
  emprendedor: "Emprendedor/a",
  colaborador: "Colaborador/a",
  mentor: "Mentor/a",
  profesional: "Profesional",
  inversor: "Inversor/a",
  empresa: "Empresa",
  institucion: "Institución",
};

export const COLLABORATION_PREFERENCES = [
  "remunerado",
  "participacion",
  "intercambio",
  "voluntario",
  "cofundador",
  "no_disponible",
] as const;

export const COLLABORATION_PREFERENCE_LABELS: Record<
  (typeof COLLABORATION_PREFERENCES)[number],
  string
> = {
  remunerado: "Remunerado",
  participacion: "Participación",
  intercambio: "Intercambio de habilidades",
  voluntario: "Voluntariado",
  cofundador: "Buscar cofundador/a",
  no_disponible: "No disponible",
};

export const SKILL_LEVELS = [1, 2, 3, 4, 5] as const;

export const SKILL_LEVEL_LABELS: Record<number, string> = {
  1: "Básico",
  2: "Principiante",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

export const MAX_INTERESTS = 20;
export const MAX_SKILLS = 20;
export const MAX_AVAILABILITY = 168;
