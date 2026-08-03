import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type ProfileRef = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type ProjectWithDetails = Database["public"]["Tables"]["projects"]["Row"] & {
  owner: ProfileRef | null;
  organization: { id: string; name: string; slug: string } | null;
};

export type ProjectMember = Database["public"]["Tables"]["project_members"]["Row"] & {
  profile: ProfileRef | null;
};

export type ProjectNeed = Database["public"]["Tables"]["project_needs"]["Row"] & {
  skill: { id: string; name: string } | null;
};

export type ProjectLink = Database["public"]["Tables"]["project_links"]["Row"];

const PROJECT_WITH_DETAILS =
  "*, owner:profiles(id, full_name, username, avatar_url), organization:organizations(id, name, slug)";

export type ListProjectFilters = {
  search?: string;
  stage?: string;
  industry?: string;
  limit?: number;
};

export async function getProjectBySlug(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<ProjectWithDetails | null> {
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_WITH_DETAILS)
    .eq("slug", slug)
    .maybeSingle();

  return data;
}

export async function listPublishedProjects(
  supabase: SupabaseClient<Database>,
  filters: ListProjectFilters = {},
): Promise<ProjectWithDetails[]> {
  let query = supabase
    .from("projects")
    .select(PROJECT_WITH_DETAILS)
    .eq("is_public", true)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,tagline.ilike.%${filters.search}%`);
  }
  if (filters.stage) {
    query = query.eq("stage", filters.stage);
  }
  if (filters.industry) {
    query = query.contains("industries", [filters.industry]);
  }
  if (filters.limit != null) {
    query = query.limit(filters.limit);
  }

  const { data } = await query;
  return data ?? [];
}

export async function listProjectsForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProjectWithDetails[]> {
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_WITH_DETAILS)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  return data ?? [];
}

export async function listProjectsByOrganization(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<ProjectWithDetails[]> {
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_WITH_DETAILS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function isProjectMember(
  supabase: SupabaseClient<Database>,
  projectId: string,
  profileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", profileId)
    .maybeSingle();

  return data != null;
}

export async function getProjectMembers(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ProjectMember[]> {
  const { data } = await supabase
    .from("project_members")
    .select("*, profile:profiles(id, full_name, username, avatar_url)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function getProjectNeeds(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ProjectNeed[]> {
  const { data } = await supabase
    .from("project_needs")
    .select("*, skill:skills(id, name)")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  return data ?? [];
}

export async function getProjectLinks(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ProjectLink[]> {
  const { data } = await supabase
    .from("project_links")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  return data ?? [];
}
