export type MessagingErrorCode =
  | "AUTH_REQUIRED"
  | "SELF_DM_DENIED"
  | "TARGET_NOT_FOUND"
  | "BLOCKED"
  | "EMPTY_BODY"
  | "BODY_TOO_LONG"
  | "FLOOD"
  | "NOT_MEMBER"
  | "FAILED";

export type ConversationCounterpart = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

/** Fila del listado /mensajes. `lastMessage` trae el último mensaje ya
 * resuelto (sin N+1: se calcula en la capa de datos con consultas acotadas). */
export type ConversationListItem = {
  id: string;
  last_message_at: string | null;
  counterpart: ConversationCounterpart;
  unreadCount: number;
  lastMessage: { body: string; created_at: string; sender_id: string } | null;
};

export type MessageItem = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
};
