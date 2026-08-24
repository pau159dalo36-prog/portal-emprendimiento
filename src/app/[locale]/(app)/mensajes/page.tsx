import { getLocale, getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { listConversations } from "@/messaging/data";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("messages") };
}

export default async function MessagesPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("conversations");
  const locale = await getLocale();
  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const conversations = await listConversations(supabase, user.id);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {conversations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2" aria-label={t("listLabel")}>
          {conversations.map((conversation) => {
            const name =
              conversation.counterpart.full_name ??
              conversation.counterpart.username ??
              t("anonymous");

            return (
              <li key={conversation.id}>
                <Link
                  href={`/mensajes/${conversation.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3 transition-colors hover:bg-muted"
                  aria-label={name}
                >
                  <Avatar
                    name={conversation.counterpart.full_name ?? undefined}
                    src={conversation.counterpart.avatar_url ?? undefined}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {conversation.lastMessage?.body ?? t("noMessagesYet")}
                    </span>
                  </span>
                  <span className="grid shrink-0 justify-items-end gap-1">
                    <time
                      dateTime={conversation.last_message_at ?? undefined}
                      className="text-[11px] text-muted-foreground"
                    >
                      {conversation.last_message_at
                        ? dateFormatter.format(new Date(conversation.last_message_at))
                        : ""}
                    </time>
                    {conversation.unreadCount > 0 && (
                      <span
                        className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
                        aria-label={t("unreadCount", { count: conversation.unreadCount })}
                      >
                        {conversation.unreadCount}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
