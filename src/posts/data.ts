import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { PostWithDetails } from "@/posts/types";

// Relaciones del post: autor, vídeo enlazado (si lo hay), proyecto y organización.
// Los posts de vídeo solo se sirven si su contenido es distribuible (RLS del
// vídeo), por lo que la relación `video` ya llega filtrada por la base de datos.
// Nota: el feed (Para ti/Siguiendo) NO usa esta capa: se sirve vía RPC en
// `src/feed/data.ts`. Estas consultas son para páginas de detalle/listing.
const POST_WITH_DETAILS =
  "*, author:profiles!posts_author_id_fkey(id, full_name, username, avatar_url), video:videos!posts_video_id_fkey(id, title, caption, thumbnail_path, thumbnail_bucket, poster_path, poster_bucket, duration_seconds, width, height, visibility), project:projects(id, name, slug), organization:organizations!posts_organization_id_fkey(id, name, slug)";

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
