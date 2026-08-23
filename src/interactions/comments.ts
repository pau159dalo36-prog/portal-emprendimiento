import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_COMMENT_BODY_LENGTH } from "@/config/interactions";
import type { Database } from "@/types/database.types";

import type { CommentWithAuthor, InteractionResult } from "@/interactions/types";

// Relación del autor vía FK real post_comments_author_id_fkey. La RLS ya
// filtra comentarios ocultos y de contenido no público; aquí solo ordenamos.
const COMMENT_WITH_AUTHOR =
  "*, author:profiles!post_comments_author_id_fkey(id, full_name, username, avatar_url)";

export async function listCommentsForPost(
  supabase: SupabaseClient<Database>,
  postId: string,
): Promise<CommentWithAuthor[]> {
  const { data } = await supabase
    .from("post_comments")
    .select(COMMENT_WITH_AUTHOR)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function createComment(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { postId: string; parentId: string | null; body: string },
): Promise<{ id: string | null } & InteractionResult> {
  const body = input.body.trim();

  if (body.length === 0) {
    return { id: null, error: "EMPTY_BODY" };
  }
  if (body.length > MAX_COMMENT_BODY_LENGTH) {
    return { id: null, error: "BODY_TOO_LONG" };
  }

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: input.postId,
      author_id: userId,
      parent_id: input.parentId,
      body,
    })
    .select("id")
    .single();

  if (error) {
    return {
      id: null,
      error: error.message.includes("COMMENT_PARENT_INVALID") ? "INVALID_PARENT" : "FAILED",
      errorMessage: error.message,
    };
  }

  return { id: data?.id ?? null, error: null };
}

export async function updateOwnComment(
  supabase: SupabaseClient<Database>,
  userId: string,
  commentId: string,
  body: string,
): Promise<InteractionResult> {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { error: "EMPTY_BODY" };
  }
  if (trimmed.length > MAX_COMMENT_BODY_LENGTH) {
    return { error: "BODY_TOO_LONG" };
  }

  // El filtro por author_id garantiza que solo se edite lo propio; si la fila
  // no existe o es ajena, el update no afecta a nada y devolvemos NOT_OWN.
  const { data, error } = await supabase
    .from("post_comments")
    .update({ body: trimmed })
    .eq("id", commentId)
    .eq("author_id", userId)
    .select("id");

  if (error) {
    return { error: "FAILED", errorMessage: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "NOT_OWN_COMMENT" };
  }

  return { error: null };
}

export async function setOwnCommentHidden(
  supabase: SupabaseClient<Database>,
  userId: string,
  commentId: string,
  hidden: boolean,
): Promise<InteractionResult> {
  const { data, error } = await supabase
    .from("post_comments")
    .update({ is_hidden: hidden })
    .eq("id", commentId)
    .eq("author_id", userId)
    .select("id");

  if (error) {
    return { error: "FAILED", errorMessage: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "NOT_OWN_COMMENT" };
  }

  return { error: null };
}

export async function deleteOwnComment(
  supabase: SupabaseClient<Database>,
  userId: string,
  commentId: string,
): Promise<InteractionResult> {
  const { data, error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", userId)
    .select("id");

  if (error) {
    return { error: "FAILED", errorMessage: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "NOT_OWN_COMMENT" };
  }

  return { error: null };
}
