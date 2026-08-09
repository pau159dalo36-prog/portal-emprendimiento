import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type FollowCounts = {
  followers: number;
  following: number;
};

export type FollowResult = {
  error: string | null;
};

export async function isFollowingProfile(
  supabase: SupabaseClient<Database>,
  followerId: string,
  followingId: string,
): Promise<boolean> {
  if (followerId === followingId) {
    return false;
  }
  const { data } = await supabase
    .from("profile_follows")
    .select("id")
    .eq("profile_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return data !== null;
}

export async function followProfile(
  supabase: SupabaseClient<Database>,
  followerId: string,
  followingId: string,
): Promise<FollowResult> {
  if (followerId === followingId) {
    return { error: "SELF_FOLLOW" };
  }
  const { error } = await supabase
    .from("profile_follows")
    .upsert(
      { profile_id: followerId, following_id: followingId },
      { onConflict: "profile_id, following_id", ignoreDuplicates: true },
    );
  return { error: error?.message ?? null };
}

export async function unfollowProfile(
  supabase: SupabaseClient<Database>,
  followerId: string,
  followingId: string,
): Promise<FollowResult> {
  const { error } = await supabase
    .from("profile_follows")
    .delete()
    .eq("profile_id", followerId)
    .eq("following_id", followingId);
  return { error: error?.message ?? null };
}

export async function isFollowingProject(
  supabase: SupabaseClient<Database>,
  followerId: string,
  projectId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("project_follows")
    .select("id")
    .eq("profile_id", followerId)
    .eq("project_id", projectId)
    .maybeSingle();
  return data !== null;
}

export async function followProject(
  supabase: SupabaseClient<Database>,
  followerId: string,
  projectId: string,
): Promise<FollowResult> {
  const { error } = await supabase
    .from("project_follows")
    .upsert(
      { profile_id: followerId, project_id: projectId },
      { onConflict: "profile_id, project_id", ignoreDuplicates: true },
    );
  return { error: error?.message ?? null };
}

export async function unfollowProject(
  supabase: SupabaseClient<Database>,
  followerId: string,
  projectId: string,
): Promise<FollowResult> {
  const { error } = await supabase
    .from("project_follows")
    .delete()
    .eq("profile_id", followerId)
    .eq("project_id", projectId);
  return { error: error?.message ?? null };
}

export async function isFollowingOrganization(
  supabase: SupabaseClient<Database>,
  followerId: string,
  organizationId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_follows")
    .select("id")
    .eq("profile_id", followerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data !== null;
}

export async function followOrganization(
  supabase: SupabaseClient<Database>,
  followerId: string,
  organizationId: string,
): Promise<FollowResult> {
  const { error } = await supabase
    .from("organization_follows")
    .upsert(
      { profile_id: followerId, organization_id: organizationId },
      { onConflict: "profile_id, organization_id", ignoreDuplicates: true },
    );
  return { error: error?.message ?? null };
}

export async function unfollowOrganization(
  supabase: SupabaseClient<Database>,
  followerId: string,
  organizationId: string,
): Promise<FollowResult> {
  const { error } = await supabase
    .from("organization_follows")
    .delete()
    .eq("profile_id", followerId)
    .eq("organization_id", organizationId);
  return { error: error?.message ?? null };
}

export async function getProfileFollowCounts(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<FollowCounts> {
  const [followersRes, followingRes] = await Promise.all([
    supabase.rpc("count_profile_followers", { p_profile_id: profileId }),
    supabase.rpc("count_profile_following", { p_profile_id: profileId }),
  ]);
  return {
    followers: followersRes.data ?? 0,
    following: followingRes.data ?? 0,
  };
}

export async function getProjectFollowCount(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<number> {
  const { data } = await supabase.rpc("count_project_followers", { p_project_id: projectId });
  return data ?? 0;
}

export async function getOrganizationFollowCount(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<number> {
  const { data } = await supabase.rpc("count_organization_followers", {
    p_organization_id: organizationId,
  });
  return data ?? 0;
}

// Identidades seguidas por un perfil. Utilizadas por el feed "Siguiendo"
// (FASE 4.4) para filtrar public.posts eficientemente. La RLS garantiza que
// solo se devuelvan los follows del propio usuario autenticado.
export async function getFollowedProfileIds(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("profile_follows")
    .select("following_id")
    .eq("profile_id", profileId);
  return (data ?? []).map((row) => row.following_id);
}

export async function getFollowedProjectIds(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("project_follows")
    .select("project_id")
    .eq("profile_id", profileId);
  return (data ?? []).map((row) => row.project_id);
}

export async function getFollowedOrganizationIds(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("organization_follows")
    .select("organization_id")
    .eq("profile_id", profileId);
  return (data ?? []).map((row) => row.organization_id);
}
