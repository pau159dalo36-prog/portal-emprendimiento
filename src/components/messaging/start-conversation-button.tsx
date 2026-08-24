"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";

import { startConversationAction } from "@/actions/messaging";
import { initialFormState } from "@/actions/form-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StartConversationButtonProps = {
  targetProfileId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
  className?: string;
};

/** CTA “Enviar mensaje”: crea/reutiliza la DM única con el perfil destino y
 * navega al hilo. Errores (bloqueo, self-DM) se muestran inline; la identidad
 * del actor la fija la sesión, nunca el formulario. */
export function StartConversationButton({
  targetProfileId,
  variant = "outline",
  size = "sm",
  className,
}: StartConversationButtonProps) {
  const t = useTranslations("messages");
  const [state, formAction, pending] = useActionState(
    startConversationAction,
    initialFormState,
  );

  return (
    <form action={formAction} className={cn("inline-flex flex-col gap-1", className)}>
      <input type="hidden" name="target_profile_id" value={targetProfileId} />
      <button
        type="submit"
        disabled={pending}
        className={cn(buttonVariants({ variant, size }))}
      >
        <MessageSquare aria-hidden="true" />
        {pending ? t("sending") : t("startCta")}
      </button>
      {state.status === "error" && (
        <span role="alert" className="text-xs text-destructive">
          {state.message}
        </span>
      )}
    </form>
  );
}
