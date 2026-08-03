import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type ProfileRef = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type OrganizationWithOwner = Database["public"]["Tables"]["organizations"]["Row"] & {
  owner: ProfileRef | null;
};

export type OrganizationMember = Database["public"]["Tables"]["organization_members"]["Row"] & {
  profile: ProfileRef | null;
};

export type OrganizationLink = Database["public"]["Tables"]["organization_links"]["Row"];

const ORGANIZATION_WITH_OWNER = "*, owner:profiles(id, full_name, username, avatar_url)";

export async function getOrganizationBySlug(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<OrganizationWithOwner | null> {
  const { data } = await supabase
    .from("organizations")
    .select(ORGANIZATION_WITH_OWNER)
    .eq("slug", slug)
    .maybeSingle();

  return data;
}

export async function listOrganizations(
  supabase: SupabaseClient<Database>,
): Promise<OrganizationWithOwner[]> {
  const { data } = await supabase
    .from("organizations")
    .select(ORGANIZATION_WITH_OWNER)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function isOrganizationMember(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  profileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .maybeSingle();

  return data != null;
}

export async function isOrganizationManager(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  profileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  return data != null;
}

export async function getOrganizationMembers(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<OrganizationMember[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("*, profile:profiles(id, full_name, username, avatar_url)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function getOrganizationLinks(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<OrganizationLink[]> {
  const { data } = await supabase
    .from("organization_links")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  return data ?? [];
}

export type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
};

export async function listOrganizationsForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OrganizationOption[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, role, organization:organizations!organization_members_organization_id_fkey(id, name, slug)")
    .eq("profile_id", userId);

  return (data ?? []).flatMap((row) => (row.organization ? [row.organization] : []));
}
