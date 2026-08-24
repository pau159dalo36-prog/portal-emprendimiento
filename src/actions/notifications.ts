"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import { markAllNotificationsRead, markNotificationRead } from "@/notifications/data";

function isUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && z.string().uuid().safeParse(value).success;
}

/** Marca una notificación propia como leída. El actor es SIEMPRE auth.uid():
 * el recipient_id viaja por sesión, nunca por formulario. */
export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const notificationId = formData.get("notification_id");
  if (!isUuid(notificationId)) {
    return;
  }

  const ok = await markNotificationRead(supabase, user.id, notificationId);
  if (ok) {
    revalidatePath("/notificaciones");
    revalidatePath("/", "layout");
  }
}

/** Marca todas las propias como leídas (una UPDATE acotada por RLS). */
export async function markAllNotificationsReadAction(): Promise<void> {
  const { supabase, user } = await requireUser();
  await getTranslations("notifications"); // precarga (paridad con otras acciones)

  const ok = await markAllNotificationsRead(supabase, user.id);
  if (ok) {
    revalidatePath("/notificaciones");
    revalidatePath("/", "layout");
  }
}
