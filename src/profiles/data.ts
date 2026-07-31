import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type ProfileSkill = {
  skill_id: string;
  level: number | null;
  name: string;
  slug: string;
};

export type ProfileInterest = {
  name: string;
};

export async function getProfileSkills(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<ProfileSkill[]> {
  const { data } = await supabase
    .from("profile_skills")
    .select("skill_id, level, skills(name, slug)")
    .eq("profile_id", profileId);

  return (data ?? []).map((row) => ({
    skill_id: row.skill_id,
    level: row.level,
    name: row.skills?.name ?? "",
    slug: row.skills?.slug ?? "",
  }));
}

export async function getProfileInterests(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<ProfileInterest[]> {
  const { data } = await supabase
    .from("profile_interests")
    .select("name")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function getAllSkills(
  supabase: SupabaseClient<Database>,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("skills")
    .select("id, name")
    .order("name", { ascending: true });

  return data ?? [];
}
