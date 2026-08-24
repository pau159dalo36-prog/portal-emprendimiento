import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { NotificationItem } from "@/notifications/types";

// Capa de datos de notificaciones (FASE 10). El cliente recibe el cliente
// Supabase inyectado (patrón del repo) y la autorización vive en RLS:
// recipient_id = auth.uid() para SELECT/UPDATE. Aquí NO se inserta nunca:
// las notificaciones nacen solo del outbox interaction_events.

/** Listado propio, más recientes primero (RLS acota al recipiente). */
export async function listNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 50,
): Promise<NotificationItem[]> {
  const { data } = await supabase
    .from("notifications")
    .select(
      `id, recipient_id, event_type, entity_id, read_at, created_at,
       actor:profiles!notifications_actor_id_fkey(id, username, full_name, avatar_url)`,
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as unknown as NotificationItem[];
}

/** Conteo de no leídas vía RPC derivada (sin contadores mutables). */
export async function getUnreadNotificationCount(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const { data } = await supabase.rpc("get_unread_notification_count");
  return Number(data ?? 0);
}

/** Marca una notificación propia como leída. RLS garantiza el perímetro; el
 * eq(recipient_id) adicional es defensa en profundidad sin coste. */
export async function markNotificationRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .is("read_at", null)
    .select("id");

  return !error && (data ?? []).length > 0;
}

/** Marca todas las propias como leídas (una sola UPDATE). */
export async function markAllNotificationsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);

  return !error;
}
