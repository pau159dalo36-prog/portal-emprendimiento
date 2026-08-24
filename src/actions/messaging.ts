"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import { validationState, type FormState } from "@/actions/form-state";
import { getPathname } from "@/i18n/navigation";
import { SEND_RATE_LIMIT_PER_MINUTE, SEND_RATE_WINDOW_MS } from "@/messaging/config";
import {
  getOrCreateDm,
  markConversationRead,
  sendMessage,
} from "@/messaging/data";
import {
  conversationIdSchema,
  createMessageSchema,
  targetProfileIdSchema,
} from "@/messaging/validations";
import type { MessagingErrorCode } from "@/messaging/types";

/** Códigos SQL/RPC → sufijos de clave i18n (messages.error*). */
function errorKey(error: MessagingErrorCode): string {
  switch (error) {
    case "AUTH_REQUIRED":
      return "AuthRequired";
    case "SELF_DM_DENIED":
      return "SelfDm";
    case "TARGET_NOT_FOUND":
      return "TargetNotFound";
    case "BLOCKED":
      return "Blocked";
    case "EMPTY_BODY":
      return "Empty";
    case "BODY_TOO_LONG":
      return "TooLong";
    case "FLOOD":
      return "Flood";
    case "NOT_MEMBER":
      return "NotMember";
    default:
      return "Failed";
  }
}

/** Abre (o reutiliza) la DM con el perfil indicado y navega al hilo.
 * El actor es SIEMPRE auth.uid(); el target llega validado por UUID. */
export async function startConversationAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("messages");

  const parsedTarget = targetProfileIdSchema.safeParse(formData.get("target_profile_id"));
  if (!parsedTarget.success) {
    return { status: "error", message: t("errorFailed") };
  }

  const { conversationId, error } = await getOrCreateDm(supabase, parsedTarget.data);
  if (error !== null || conversationId === null) {
    return { status: "error", message: t(`error${errorKey(error ?? "FAILED")}`) };
  }

  revalidatePath("/", "layout");
  redirect(getPathname({ href: `/mensajes/${conversationId}`, locale }));
}

/** Envía un mensaje a una conversación propia. Anti-spam MVP: rate limit
 * server-side por remitente (sin fingerprint/IP). RLS bloquea lo demás. */
export async function sendMessageAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("messages");

  const parsedConversation = conversationIdSchema.safeParse(
    formData.get("conversation_id"),
  );
  if (!parsedConversation.success) {
    return { status: "error", message: t("errorNotMember") };
  }
  const conversationId = parsedConversation.data;

  const parsedBody = createMessageSchema().safeParse({ body: formData.get("body") });
  if (!parsedBody.success) {
    return validationState(parsedBody.error, t("errorEmpty"));
  }

  // Flood accidental: N mensajes/minuto por remitente (índice sender+created_at).
  const since = new Date(Date.now() - SEND_RATE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("created_at", since);

  if ((count ?? 0) >= SEND_RATE_LIMIT_PER_MINUTE) {
    return { status: "error", message: t("errorFlood") };
  }

  const { error } = await sendMessage(
    supabase,
    conversationId,
    user.id,
    parsedBody.data.body,
  );
  if (error !== null) {
    return { status: "error", message: t(`error${errorKey(error)}`) };
  }

  await markConversationRead(supabase, user.id, conversationId);
  revalidatePath(`/mensajes/${conversationId}`);
  revalidatePath("/mensajes");
  return { status: "success", message: t("sent") };
}

/** Marca un hilo como leído al abrirlo (llamado por efecto cliente). */
export async function markConversationReadAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = conversationIdSchema.safeParse(formData.get("conversation_id"));
  if (!parsed.success) {
    return;
  }

  if (await markConversationRead(supabase, user.id, parsed.data)) {
    revalidatePath("/mensajes");
    revalidatePath("/", "layout");
  }
}
