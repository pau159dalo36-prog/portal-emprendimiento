export type NotificationEventType =
  | "new_follow"
  | "comment_created"
  | "reply_created"
  | "feedback_received"
  | "application_submitted"
  | "application_viewed"
  | "application_accepted"
  | "application_rejected"
  | "message_received";

export type NotificationActor = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

/** Fila de notificación tal y como la consume la UI. Solo IDs de contexto:
 * el payload enriquecido (nombre, título…) se resuelve en el render o no se
 * muestra — nunca snapshots denormalizados. */
export type NotificationItem = {
  id: string;
  recipient_id: string;
  event_type: NotificationEventType;
  entity_id: string;
  read_at: string | null;
  created_at: string;
  actor: NotificationActor | null;
};

const NOTIFICATION_EVENT_TYPES = [
  "new_follow",
  "comment_created",
  "reply_created",
  "feedback_received",
  "application_submitted",
  "application_viewed",
  "application_accepted",
  "application_rejected",
  "message_received",
] as const;

export function isNotificationEventType(value: string): value is NotificationEventType {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

/** Rutas de destino por tipo de evento (best-effort MVP). Los eventos sin
 * ruta clara no enlazan; el contexto completo vive en el texto. Para
 * message_received la página resuelve la conversación con entity_id. */
export function notificationHref(
  eventType: NotificationEventType,
  entityId: string,
): string | null {
  switch (eventType) {
    case "message_received":
      return `/mensajes/${entityId}`;
    case "application_submitted":
    case "application_viewed":
    case "application_accepted":
    case "application_rejected":
      return "/panel/candidaturas";
    default:
      return null;
  }
}
