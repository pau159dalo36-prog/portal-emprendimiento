"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Send, X } from "lucide-react";

import { applyToOpportunityAction, withdrawApplicationAction } from "@/actions/application";
import type { ApplicationStatus } from "@/applications/config";
import { isPendingStatus } from "@/applications/permissions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";

type ApplyButtonProps = {
  opportunityId: string;
  applicationId: string | null;
  initialStatus: ApplicationStatus | null;
  eligible: boolean;
};

const IDLE_FORM_STATE = { status: "idle" as const };

/**
 * CTA de candidatura en el detalle de una oportunidad (solo visitantes
 * autenticados que no gestionan la oportunidad). Estados:
 * sin candidatura → formulario inline opcional; pendiente → enviada + retirar;
 * terminal → etiqueta. El doble click no duplica (UNIQUE + pending).
 */
export function ApplyButton({
  opportunityId,
  applicationId,
  initialStatus,
  eligible,
}: ApplyButtonProps) {
  const t = useTranslations("applications");
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState(applyToOpportunityAction, IDLE_FORM_STATE);

  // Tras éxito la página se revalida y `initialStatus` llega actualizado.
  const status = state.status === "success" ? ("submitted" as ApplicationStatus) : initialStatus;

  if (!eligible && !status) {
    return null;
  }

  if (status === "accepted") {
    return <AppliedNotice tone="success" label={t("statusAccepted")} />;
  }
  if (status === "rejected") {
    return <AppliedNotice tone="muted" label={t("statusRejected")} />;
  }

  if (status && isPendingStatus(status)) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-600/5 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {status === "viewed" ? t("statusViewed") : t("statusSubmitted")}
        </span>
        {isPendingStatus(status) && (
          <form action={withdrawApplicationAction} className="inline-flex">
            <input type="hidden" name="application_id" value={applicationId ?? ""} />
            <SubmitButton variant="ghost" size="sm" disabled={!applicationId}>
              {t("withdraw")}
            </SubmitButton>
          </form>
        )}
      </div>
    );
  }

  if (status === "withdrawn") {
    // MVP: sin re-postulación (UNIQUE por oportunidad y persona).
    return <AppliedNotice tone="muted" label={t("statusWithdrawn")} />;
  }

  if (!expanded) {
    return (
      <Button type="button" onClick={() => setExpanded(true)}>
        {t("apply")}
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid max-w-xl gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <label htmlFor="application-message" className="text-sm font-medium">
        {t("messageLabel")}
      </label>
      <Textarea
        id="application-message"
        name="message"
        rows={3}
        maxLength={2000}
        placeholder={t("messagePlaceholder")}
        className="resize-y"
      />
      {state.status === "error" && state.message ? (
        <FormMessage status="error">{state.message}</FormMessage>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          {t("send")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setExpanded(false)}
        >
          <X aria-hidden="true" />
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

function AppliedNotice({ tone, label }: { tone: "success" | "muted"; label: string }) {
  if (tone === "success") {
    return <AppliedSuccess label={label} />;
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground">
      {label}
    </span>
  );
}

function AppliedSuccess({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-600/5 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="size-4" aria-hidden="true" />
      {label}
    </span>
  );
}
