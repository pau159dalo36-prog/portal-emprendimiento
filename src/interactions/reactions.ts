import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import type { InteractionResult } from "@/interactions/types";

export async function isPostSupportedBy(
  supabase: SupabaseClient<Database>,
  postId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("profile_id", userId)
    .eq("reaction_type", "support")
    .maybeSingle();

  return data !== null;
}

// Toggle idempotente vía RPC (UNIQUE post+perfil+'support'). La identidad del
// llamador la toma la RPC de auth.uid() (nunca de un parámetro) y aplica las
// mismas comprobaciones de privacidad/bloqueos que la RLS.
export async function togglePostSupport(
  supabase: SupabaseClient<Database>,
  postId: string,
): Promise<{ supported: boolean | null } & InteractionResult> {
  const { data, error } = await supabase.rpc("toggle_post_support", {
    p_post_id: postId,
  });

  if (error) {
    const notAllowed = error.message.includes("POST_NOT_INTERACTABLE");
    return {
      supported: null,
      error: notAllowed ? "NOT_ALLOWED" : "FAILED",
      errorMessage: error.message,
    };
  }

  return { supported: data === true, error: null };
}

export type PostInteractionCounts = {
  postId: string;
  commentCount: number;
  supportCount: number;
};

export async function getPostInteractionCounts(
  supabase: SupabaseClient<Database>,
  postIds: string[],
): Promise<Map<string, PostInteractionCounts>> {
  if (postIds.length === 0) {
    return new Map();
  }

  const { data } = await supabase.rpc("get_post_interaction_counts", {
    p_post_ids: postIds,
  });

  const counts = new Map<string, PostInteractionCounts>();
  for (const row of data ?? []) {
    counts.set(row.post_id, {
      postId: row.post_id,
      commentCount: Number(row.comment_count ?? 0),
      supportCount: Number(row.support_count ?? 0),
    });
  }
  return counts;
}
