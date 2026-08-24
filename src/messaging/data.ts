import type { SupabaseClient } from "@supabase/supabase-js";

import { MESSAGE_BODY_MAX_LENGTH } from "@/messaging/config";
import type {
  ConversationCounterpart,
  ConversationListItem,
  MessagingErrorCode,
  MessageItem,
} from "@/messaging/types";
import type { Database } from "@/types/database.types";

// Capa de datos de mensajería 1:1 (FASE 10). La autorización vive en RLS y en
// la RPC get_or_create_dm; aquí solo se orquesta el acceso sin N+1.

type Supabase = SupabaseClient<Database>;

function errorFromMessage(message: string | null | undefined): MessagingErrorCode {
  if (!message) return "FAILED";
  if (message.includes("AUTH_REQUIRED")) return "AUTH_REQUIRED";
  if (message.includes("SELF_DM_DENIED")) return "SELF_DM_DENIED";
  if (message.includes("TARGET_NOT_FOUND")) return "TARGET_NOT_FOUND";
  if (message.includes("BLOCKED")) return "BLOCKED";
  return "FAILED";
}

/**
 * Abre la DM única con targetProfileId (o devuelve la existente).
 * Actor SIEMPRE auth.uid() dentro de la RPC; nunca se acepta del cliente.
 */
export async function getOrCreateDm(
  supabase: Supabase,
  targetProfileId: string,
): Promise<{ conversationId: string | null; error: MessagingErrorCode | null }> {
  const { data, error } = await supabase.rpc("get_or_create_dm", {
    p_target_profile_id: targetProfileId,
  });

  if (error) {
    return { conversationId: null, error: errorFromMessage(error.message) };
  }
  if (!data) {
    return { conversationId: null, error: "FAILED" };
  }
  return { conversationId: data as string, error: null };
}

const COUNTERPART_FIELDS = "id, username, full_name, avatar_url" as const;

/**
 * Listado de conversaciones propias con contraparte, último mensaje y unread,
 * en un número FIJO de consultas (sin N+1): membresías → conversaciones →
 * contrapartes → últimos mensajes acotados.
 */
export async function listConversations(
  supabase: Supabase,
  userId: string,
  limit = 50,
): Promise<ConversationListItem[]> {
  // 1) Mis membresías.
  const { data: memberships, error: membersError } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("profile_id", userId)
    .order("last_read_at", { ascending: false })
    .limit(limit);

  if (membersError || !memberships || memberships.length === 0) {
    return [];
  }
  const conversationIds = [...new Set(memberships.map((m) => m.conversation_id))];

  // 2) Conversaciones (orden por último mensaje) + miembro ajeno (contraparte)
  //    + últimos mensajes de TODAS mis conversaciones en UNA consulta acotada.
  const [conversationsResult, othersResult, messagesResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, last_message_at")
      .in("id", conversationIds)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("conversation_members")
      .select(`conversation_id, profile:profiles!conversation_members_profile_id_fkey(${COUNTERPART_FIELDS})`)
      .in("conversation_id", conversationIds)
      .neq("profile_id", userId),
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(conversationIds.length * 30),
  ]);

  const counterparts = new Map<string, ConversationCounterpart>();
  for (const row of othersResult.data ?? []) {
    const profile = row.profile as unknown as ConversationCounterpart | null;
    if (profile?.id) counterparts.set(row.conversation_id, profile);
  }

  const lastByConversation = new Map<
    string,
    { body: string; created_at: string; sender_id: string }
  >();
  for (const message of messagesResult.data ?? []) {
    if (!lastByConversation.has(message.conversation_id)) {
      lastByConversation.set(message.conversation_id, {
        body: message.body,
        created_at: message.created_at,
        sender_id: message.sender_id,
      });
    }
  }

  const lastReadByConversation = new Map(
    memberships.map((m) => [m.conversation_id, m.last_read_at] as const),
  );

  const items: ConversationListItem[] = [];
  for (const conversation of conversationsResult.data ?? []) {
    const counterpart = counterparts.get(conversation.id);
    if (!counterpart) continue; // sin contraparte visible: no renderizar

    const lastReadAt = lastReadByConversation.get(conversation.id);
    let unreadCount = 0;
    for (const message of messagesResult.data ?? []) {
      if (
        message.conversation_id === conversation.id &&
        message.sender_id !== userId &&
        (!lastReadAt || message.created_at > lastReadAt)
      ) {
        unreadCount += 1;
      }
    }

    items.push({
      id: conversation.id,
      last_message_at: conversation.last_message_at,
      counterpart,
      unreadCount,
      lastMessage: lastByConversation.get(conversation.id) ?? null,
    });
  }
  return items;
}

/** Contraparte de una conversación propia (null si no es miembro: RLS). */
export async function getConversationCounterpart(
  supabase: Supabase,
  userId: string,
  conversationId: string,
): Promise<ConversationCounterpart | null> {
  // Si no soy miembro, mi propia fila de membresía no existe → sin acceso.
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (!mine) return null;

  const { data } = await supabase
    .from("conversation_members")
    .select(`profile:profiles!conversation_members_profile_id_fkey(${COUNTERPART_FIELDS})`)
    .eq("conversation_id", conversationId)
    .neq("profile_id", userId)
    .maybeSingle();

  const profile = data?.profile as unknown as ConversationCounterpart | null;
  return profile && profile.id ? profile : null;
}

/** Mensajes de una conversación propia, cronológicos. */
export async function listMessages(
  supabase: Supabase,
  conversationId: string,
  limit = 200,
): Promise<MessageItem[]> {
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, edited_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? []) as MessageItem[];
}

/** Inserta el mensaje del usuario autenticado. RLS exige sender real +
 * membresía + ausencia de bloqueos. Devuelve el código traducible o null. */
export async function sendMessage(
  supabase: Supabase,
  conversationId: string,
  senderId: string,
  body: string,
): Promise<{ message: MessageItem | null; error: MessagingErrorCode | null }> {
  const trimmed = body.trim();
  if (trimmed.length < 1) {
    return { message: null, error: "EMPTY_BODY" };
  }
  if (trimmed.length > MESSAGE_BODY_MAX_LENGTH) {
    return { message: null, error: "BODY_TOO_LONG" };
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
    .select("id, conversation_id, sender_id, body, created_at, edited_at")
    .single();

  if (error) {
    return { message: null, error: errorFromMessage(error.message) };
  }
  return { message: data as MessageItem, error: null };
}

/** Marca la conversación como leída para el usuario actual. */
export async function markConversationRead(
  supabase: Supabase,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", userId);

  return !error;
}

/** Total de mensajes sin leer (RPC derivada, invoker + RLS). */
export async function getUnreadMessagesTotal(
  supabase: Supabase,
): Promise<number> {
  const { data } = await supabase.rpc("get_unread_messages_total");
  return Number(data ?? 0);
}
