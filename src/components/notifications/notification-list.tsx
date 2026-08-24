"use client";

import { useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";

import { markAllNotificationsReadAction } from "@/actions/notifications";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MarkReadForm } from "@/components/notifications/mark-read-form";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/notifications/types";
import { notificationHref } from "@/notifications/types";
import { Link } from "@/i18n/navigation";

type NotificationListProps = {
  items: NotificationItem[];
  locale: string;
};

function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Listado de notificaciones del usuario (RLS solo entrega las propias).
 * Acciones: abrir contexto, marcar una y marcar todas. Mobile-first. */
export function NotificationList({ items, locale }: NotificationListProps) {
  const t = useTranslations("notifications");
  const tt = useTranslations("notificationTypes");
  const nav = useTranslations("nav");

  const unreadCount = items.filter((item) => item.read_at === null).length;

  return (
    <div className="grid gap-4">
      <form action={markAllNotificationsReadAction} className="flex justify-end">
        <Button type="submit" variant="outline" size="sm" disabled={unreadCount === 0}>
          <CheckCheck aria-hidden="true" />
          {t("markAllRead")}
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-2" aria-label={nav("notifications")}>
          {items.map((item) => {
            const href = notificationHref(item.event_type, item.entity_id);
            const unread = item.read_at === null;

            const content = (
              <>
                <span className="relative shrink-0">
                  <Avatar
                    name={item.actor?.full_name ?? undefined}
                    src={item.actor?.avatar_url ?? undefined}
                    size="sm"
                  />
                  <Bell
                    aria-hidden="true"
                    className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-background text-primary"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {tt(item.event_type)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.actor?.full_name ?? t("unknownActor")} ·{" "}
                    {formatTime(item.created_at, locale)}
                  </span>
                </span>
                {unread && (
                  <span
                    aria-label={t("unreadLabel")}
                    className="size-2 shrink-0 rounded-full bg-primary"
                  />
                )}
              </>
            );

            return (
              <li key={item.id} className="flex items-stretch gap-1">
                {href ? (
                  <Link
                    href={href}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted",
                      unread && "bg-primary/5",
                    )}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5",
                      unread && "bg-primary/5",
                    )}
                  >
                    {content}
                  </div>
                )}
                {unread && <MarkReadForm id={item.id} label={t("markRead")} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
