import type { Database } from "@/types/database.types";

export type CompletionSection = {
  key: string;
  label: string;
  done: boolean;
};

export function getCompletionSections(
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null,
  skillsCount: number,
  interestsCount: number,
): CompletionSection[] {
  return [
    { key: "nombre", label: "Nombre público", done: Boolean(profile?.full_name) },
    { key: "username", label: "Username", done: Boolean(profile?.username) },
    { key: "headline", label: "Titular profesional", done: Boolean(profile?.headline) },
    { key: "bio", label: "Biografía", done: Boolean(profile?.bio) },
    { key: "location", label: "Ubicación", done: Boolean(profile?.location) },
    { key: "roles", label: "Roles", done: (profile?.user_types.length ?? 0) > 0 },
    { key: "habilidades", label: "Habilidades", done: skillsCount > 0 },
    { key: "intereses", label: "Intereses", done: interestsCount > 0 },
    {
      key: "disponibilidad",
      label: "Disponibilidad semanal",
      done: profile?.weekly_availability != null,
    },
    {
      key: "colaboracion",
      label: "Preferencias de colaboración",
      done: (profile?.collaboration_preferences.length ?? 0) > 0,
    },
    {
      key: "enlaces",
      label: "Web y LinkedIn",
      done: Boolean(profile?.website_url || profile?.linkedin_url),
    },
    { key: "avatar", label: "Avatar", done: Boolean(profile?.avatar_url) },
  ];
}

export function getCompletionPercent(sections: CompletionSection[]): number {
  if (sections.length === 0) return 0;
  const done = sections.filter((section) => section.done).length;
  return Math.round((done / sections.length) * 100);
}
