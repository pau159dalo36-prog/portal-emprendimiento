import type { Database } from "@/types/database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type SkillOption = {
  id: string;
  name: string;
};

export type SkillSelection = Record<string, number | null>;

export type ProfileFormData = {
  full_name: string | null;
  username: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  user_types: string[];
  weekly_availability: number | null;
  collaboration_preferences: string[];
  website_url: string | null;
  linkedin_url: string | null;
  is_public: boolean;
  avatar_url: string | null;
};

export function toSkillSelection(
  skills: { skill_id: string; level: number | null }[],
): SkillSelection {
  return Object.fromEntries(skills.map((skill) => [skill.skill_id, skill.level]));
}

export function toProfileFormData(profile: ProfileRow | null): ProfileFormData {
  return {
    full_name: profile?.full_name ?? null,
    username: profile?.username ?? null,
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    location: profile?.location ?? null,
    user_types: profile?.user_types ?? [],
    weekly_availability: profile?.weekly_availability ?? null,
    collaboration_preferences: profile?.collaboration_preferences ?? [],
    website_url: profile?.website_url ?? null,
    linkedin_url: profile?.linkedin_url ?? null,
    is_public: profile?.is_public ?? true,
    avatar_url: profile?.avatar_url ?? null,
  };
}
