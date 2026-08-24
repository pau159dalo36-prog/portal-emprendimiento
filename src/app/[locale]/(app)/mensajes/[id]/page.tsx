import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { MessageComposer } from "@/components/messaging/message-composer";
import { MarkThreadRead } from "@/components/messaging/mark-thread-read";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import {
  getConversationCounterpart,
  listMessages,
} from "@/messaging/data";

type ConversationPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata() {
  return { title: await pageMetadataTitle("messages") };
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { id, locale } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("messages");
  const tc = await getTranslations("conversations");
  const timeFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // RLS: si no soy miembro, la contraparte no resuelve ⇒ notFound fail-closed.
  const counterpart = await getConversationCounterpart(supabase, user.id, id);
  if (!counterpart) {
    notFound();
  }

  const messages = await listMessages(supabase, id);
  const displayName =
    counterpart.full_name ?? counterpart.username ?? tc("anonymous");

  return (
    <div className="grid gap-4">
      <MarkThreadRead conversationId={id} />

      <div className="grid gap-1">
        <Link
          href="/mensajes"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {tc("backToList")}
        </Link>
        <div className="flex items-center gap-3 pt-1">
          <Avatar
            name={counterpart.full_name ?? undefined}
            src={counterpart.avatar_url ?? undefined}
            size="md"
          />
          <div className="min-w-0 grid gap-0.5">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {displayName}
            </h1>
            <span className="truncate text-xs text-muted-foreground">
              {t("dmHint")}
            </span>
          </div>
        </div>
      </div>

      <ol className="grid gap-2" aria-live="polite" aria-label={t("threadLabel")}>
        {messages.map((message) => {
          const mine = message.sender_id === user.id;
          return (
            <li
              key={message.id}
              className={mine ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  mine
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground sm:max-w-[70%]"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border/60 bg-muted px-3.5 py-2 text-sm sm:max-w-[70%]"
                }
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <p
                  className={
                    mine
                      ? "mt-1 text-right text-[10px] opacity-80"
                      : "mt-1 text-right text-[10px] text-muted-foreground"
                  }
                >
                  {timeFormatter.format(new Date(message.created_at))}
                  {message.edited_at ? ` · ${t("edited")}` : ""}
                </p>
              </div>
            </li>
          );
        })}
        {messages.length === 0 && (
          <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t("emptyThread")}
          </li>
        )}
      </ol>

      <MessageComposer conversationId={id} />
    </div>
  );
}
