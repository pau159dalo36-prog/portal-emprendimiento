"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import type { FormState } from "@/actions/form-state";
import { SAVE_TARGETS, type SaveTarget } from "@/config/interactions";
import { createComment, deleteOwnComment, setOwnCommentHidden, updateOwnComment } from "@/interactions/comments";
import { upsertProjectFeedback } from "@/interactions/feedback";
import { togglePostSupport } from "@/interactions/reactions";
import { toggleSave } from "@/interactions/saves";
import {
  createCommentSchema,
  isInteractionTargetId,
  projectFeedbackSchema,
  updateCommentSchema,
} from "@/validations/interactions";

function isSaveTarget(value: unknown): value is SaveTarget {
  return typeof value === "string" && (SAVE_TARGETS as readonly string[]).includes(value);
}

export async function createCommentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("interactions.comments");

  const parsed = createCommentSchema.safeParse({
    postId: formData.get("post_id"),
    parentId: formData.get("parent_id") || null,
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { status: "error", message: t("invalidBody") };
  }

  const result = await createComment(supabase, user.id, {
    postId: parsed.data.postId,
    parentId: parsed.data.parentId,
    body: parsed.data.body,
  });

  if (result.error) {
    return { status: "error", message: mapCommentError(t, result.error, result.errorMessage) };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("created") };
}

export async function updateCommentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("interactions.comments");

  const parsed = updateCommentSchema.safeParse({
    commentId: formData.get("comment_id"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { status: "error", message: t("invalidBody") };
  }

  const result = await updateOwnComment(supabase, user.id, parsed.data.commentId, parsed.data.body);
  if (result.error) {
    return { status: "error", message: mapCommentError(t, result.error, result.errorMessage) };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("updated") };
}

// "Eliminar" propio: oculta el comentario conservando el hilo. El borrado
// físico también es posible desde la BD, pero la UI usa el soft-hide.
export async function hideCommentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("interactions.comments");

  const commentId = formData.get("comment_id");
  if (!isInteractionTargetId(commentId)) {
    return { status: "error", message: t("failed") };
  }

  const result = await setOwnCommentHidden(supabase, user.id, commentId, true);
  if (result.error) {
    return { status: "error", message: mapCommentError(t, result.error, result.errorMessage) };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("hidden") };
}

export async function deleteCommentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("interactions.comments");

  const commentId = formData.get("comment_id");
  if (!isInteractionTargetId(commentId)) {
    return { status: "error", message: t("failed") };
  }

  const result = await deleteOwnComment(supabase, user.id, commentId);
  if (result.error) {
    return { status: "error", message: mapCommentError(t, result.error, result.errorMessage) };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("deleted") };
}

export async function upsertFeedbackAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("interactions.feedback");

  const parsed = projectFeedbackSchema.safeParse({
    projectId: formData.get("project_id"),
    understanding: formData.get("understanding"),
    problem: formData.get("problem"),
    useful: formData.get("useful"),
    unclear: formData.get("unclear"),
    suggestions: formData.get("suggestions"),
    wouldUse: formData.get("would_use") ?? "maybe",
    interestScore: formData.get("interest_score") ?? null,
  });

  if (!parsed.success) {
    return { status: "error", message: t("invalidInput") };
  }

  const result = await upsertProjectFeedback(supabase, user.id, {
    projectId: parsed.data.projectId,
    understanding: parsed.data.understanding,
    problem: parsed.data.problem,
    useful: parsed.data.useful,
    unclear: parsed.data.unclear,
    suggestions: parsed.data.suggestions,
    wouldUse: parsed.data.wouldUse,
    interestScore: parsed.data.interestScore,
  });

  if (result.error) {
    return { status: "error", message: t("failed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("saved") };
}

export type SupportFormState = FormState & { supported?: boolean };

export async function toggleSupportAction(
  _prevState: SupportFormState,
  formData: FormData,
): Promise<SupportFormState> {
  // La RPC deduce la identidad del llamador con auth.uid() en la BD.
  const { supabase } = await requireUser();
  const t = await getTranslations("interactions.reactions");

  const postId = formData.get("post_id");
  if (!isInteractionTargetId(postId)) {
    return { status: "error", message: t("failed") };
  }

  const result = await togglePostSupport(supabase, postId);
  if (result.error || result.supported === null) {
    return {
      status: "error",
      message: result.error === "NOT_ALLOWED" ? t("notAllowed") : t("failed"),
    };
  }

  revalidatePath("/", "layout");
  return { status: "success", supported: result.supported };
}

export type SaveFormState = FormState & { saved?: boolean };

export async function toggleSaveAction(
  _prevState: SaveFormState,
  formData: FormData,
): Promise<SaveFormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("interactions.saves");

  const targetType = formData.get("target_type");
  const targetId = formData.get("target_id");
  if (!isSaveTarget(targetType) || !isInteractionTargetId(targetId)) {
    return { status: "error", message: t("failed") };
  }

  const result = await toggleSave(supabase, user.id, targetType, targetId);
  if (result.error || result.saved === null) {
    return { status: "error", message: t("failed"), saved: undefined };
  }

  revalidatePath("/", "layout");
  return { status: "success", saved: result.saved };
}

type CommentTranslator = {
  (key: "invalidBody" | "failed" | "notAllowed"): string;
};

function mapCommentError(
  t: CommentTranslator,
  error: string,
  errorMessage?: string,
): string {
  if (error === "EMPTY_BODY" || error === "BODY_TOO_LONG") {
    return t("invalidBody");
  }
  if (error === "INVALID_PARENT") {
    return t("notAllowed");
  }
  if (error === "NOT_ALLOWED") {
    return t("notAllowed");
  }
  if (error === "NOT_OWN_COMMENT") {
    return t("notAllowed");
  }
  void errorMessage;
  return t("failed");
}
