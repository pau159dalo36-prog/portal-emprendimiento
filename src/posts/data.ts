import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { POST_DISTRIBUTABLE_PUBLICATION_STATUSES } from "@/config/post";
import type { PostWithDetails } from "@/posts/types";

export type ListPostsFilters = {
  limit?: number;
  authorId?: string;
};

// Relaciones del post: autor, vídeo enlazado (si lo hay), proyecto y organización.
// Los posts de vídeo solo se sirven si su contenido es distribuible (RLS del
// vídeo), por lo que la relación `video` ya llega filtrada por la base de datos.
const POST_WITH_DETAILS =
  "*, author:profiles!posts_author_id_fkey(id, full_name, username, avatar_url), video:videos!posts_video_id_fkey(id, title, caption, thumbnail_path, thumbnail_bucket, poster_path, poster_bucket, duration_seconds, width, height, visibility), project:projects(id, name, slug), organization:organizations!posts_organization_id_fkey(id, name, slug)";

// Listado base del feed: posts distribuibles y estrictamente públicos (excluye
// 'unlisted', que solo es accesible por enlace directo). RLS garantiza que solo
// llegan posts cuyo contenido es realmente distribuible. Es la consulta primitiva
// que el algoritmo "Para ti" (FASE 4.2) extenderá.
export async function listFeedPosts(
  supabase: SupabaseClient<Database>,
  filters: ListPostsFilters = {},
): Promise<PostWithDetails[]> {
  let query = supabase
    .from("posts")
    .select(POST_WITH_DETAILS)
    .in("publication_status", [...POST_DISTRIBUTABLE_PUBLICATION_STATUSES])
    .eq("visibility", "public")
    .order("published_at", { ascending: false });

  if (filters.authorId) {
    query = query.eq("author_id", filters.authorId);
  }
  if (filters.limit != null) {
    query = query.limit(filters.limit);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getPostById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<PostWithDetails | null> {
  const { data } = await supabase
    .from("posts")
    .select(POST_WITH_DETAILS)
    .eq("id", id)
    .maybeSingle();

  return data ?? null;
}

export async function listPostsForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PostWithDetails[]> {
  const { data } = await supabase
    .from("posts")
    .select(POST_WITH_DETAILS)
    .eq("author_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}
