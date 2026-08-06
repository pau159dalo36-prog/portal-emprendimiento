import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { VideoWithDetails } from "@/videos/types";

export type ListPublishedVideosFilters = {
  limit?: number;
  authorId?: string;
};

const VIDEO_WITH_DETAILS =
  "*, owner:profiles!videos_owner_id_fkey(id, full_name, username, avatar_url), project:projects(id, name, slug)";

export async function listPublishedVideos(
  supabase: SupabaseClient<Database>,
  filters: ListPublishedVideosFilters = {},
): Promise<VideoWithDetails[]> {
  let query = supabase
    .from("videos")
    .select(VIDEO_WITH_DETAILS)
    .eq("status", "published")
    .neq("visibility", "unlisted")
    .order("published_at", { ascending: false });

  if (filters.authorId) {
    query = query.eq("owner_id", filters.authorId);
  }
  if (filters.limit != null) {
    query = query.limit(filters.limit);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getVideoById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<VideoWithDetails | null> {
  const { data } = await supabase
    .from("videos")
    .select(VIDEO_WITH_DETAILS)
    .eq("id", id)
    .maybeSingle();

  return data ?? null;
}

export async function listVideosForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<VideoWithDetails[]> {
  const { data } = await supabase
    .from("videos")
    .select(VIDEO_WITH_DETAILS)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

const MODERATION_PRIORITY: Record<string, number> = {
  pending: 0,
  flagged: 1,
  rejected: 2,
  approved: 3,
};

export async function listVideosForModeration(
  supabase: SupabaseClient<Database>,
): Promise<VideoWithDetails[]> {
  const { data } = await supabase
    .from("videos")
    .select(VIDEO_WITH_DETAILS)
    .neq("status", "removed");

  return [...(data ?? [])].sort((a, b) => {
    const priority = (MODERATION_PRIORITY[a.moderation_status] ?? 4) -
      (MODERATION_PRIORITY[b.moderation_status] ?? 4);
    if (priority !== 0) {
      return priority;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function listPublishedVideosForProject(
  supabase: SupabaseClient<Database>,
  projectId: string,
  filters: ListPublishedVideosFilters = {},
): Promise<VideoWithDetails[]> {
  let query = supabase
    .from("videos")
    .select(VIDEO_WITH_DETAILS)
    .eq("project_id", projectId)
    .eq("status", "published")
    .neq("visibility", "unlisted")
    .order("published_at", { ascending: false });

  if (filters.limit != null) {
    query = query.limit(filters.limit);
  }

  const { data } = await query;
  return data ?? [];
}
