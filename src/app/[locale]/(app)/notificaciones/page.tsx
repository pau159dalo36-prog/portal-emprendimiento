import { getLocale, getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { NotificationList } from "@/components/notifications/notification-list";
import { pageMetadataTitle } from "@/i18n/metadata";
import { listNotifications } from "@/notifications/data";
import { isNotificationEventType } from "@/notifications/types";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("notifications") };
}

export default async function NotificationsPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("notifications");
  const locale = await getLocale();

  const rows = await listNotifications(supabase, user.id);
  // Defensa en profundidad: el CHECK SQL ya limita los tipos; se filtra de
  // nuevo para que un valor inesperado nunca rompa el render.
  const items = rows.filter((row) => isNotificationEventType(row.event_type));

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <NotificationList items={items} locale={locale === "en" ? "en-US" : "es-ES"} />
    </div>
  );
}
