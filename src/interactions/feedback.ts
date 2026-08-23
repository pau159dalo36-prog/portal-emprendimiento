import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import type { InteractionResult, ProjectFeedbackRow } from "@/interactions/types";

export type UpsertFeedbackInput = {
  projectId: string;
  understanding: string;
  problem: string | null;
  useful: string | null;
  unclear: string | null;
  suggestions: string | null;
  wouldUse: "yes" | "no" | "maybe";
  interestScore: number | null;
};

export async function getMyProjectFeedback(
  supabase: SupabaseClient<Database>,
  projectId: string,
  userId: string,
): Promise<ProjectFeedbackRow | null> {
  const { data } = await supabase
    .from("project_feedback")
    .select("*")
    .eq("project_id", projectId)
    .eq("author_id", userId)
    .maybeSingle();

  return data ?? null;
}

// Un único upsert sobre el UNIQUE (project_id, author_id): crear y actualizar
// son la misma operación, así que no puede haber duplicados accidentales.
export async function upsertProjectFeedback(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: UpsertFeedbackInput,
): Promise<{ id: string | null } & InteractionResult> {
  const { data, error } = await supabase
    .from("project_feedback")
    .upsert(
      {
        project_id: input.projectId,
        author_id: userId,
        understanding: input.understanding.trim(),
        problem: input.problem?.trim() || null,
        useful: input.useful?.trim() || null,
        unclear: input.unclear?.trim() || null,
        suggestions: input.suggestions?.trim() || null,
        would_use: input.wouldUse,
        interest_score: input.interestScore,
      },
      { onConflict: "project_id, author_id" },
    )
    .select("id")
    .single();

  if (error) {
    return { id: null, error: "FAILED", errorMessage: error.message };
  }

  return { id: data?.id ?? null, error: null };
}

// Conteo público por agregación (RPC SECURITY DEFINER). Devuelve 0 para
// proyectos no públicos sin revelar si existen filas.
export async function getProjectFeedbackCount(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<number> {
  const { data } = await supabase.rpc("get_project_feedback_count", {
    p_project_id: projectId,
  });

  return typeof data === "number" ? data : 0;
}
