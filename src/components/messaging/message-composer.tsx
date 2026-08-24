"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { SendHorizonal } from "lucide-react";

import { sendMessageAction } from "@/actions/messaging";
import { initialFormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";

type MessageComposerProps = {
  conversationId: string;
};

/** Composer del hilo: textarea con Enter para enviar y Shift+Enter salto de
 * línea. Doble-submit imposible (pending); vacío/2000+ lo valida zod antes de
 * tocar la BD; bloqueos y flood llegan como error traducido de la acción. */
export function MessageComposer({ conversationId }: MessageComposerProps) {
  const t = useTranslations("messages");
  const [state, formAction, pending] = useActionState(
    sendMessageAction,
    initialFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid gap-2"
      aria-label={t("composerLabel")}
    >
      <input type="hidden" name="conversation_id" value={conversationId} />
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          rows={2}
          required
          maxLength={2000}
          placeholder={t("placeholder")}
          aria-label={t("composerLabel")}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={pending} aria-label={t("send")}>
          <SendHorizonal aria-hidden="true" />
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p aria-live="polite" className="sr-only">
          {state.message}
        </p>
      )}
    </form>
  );
}
