"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, Flag, Loader2, ShieldAlert, X } from "lucide-react";

import { moderateOpportunityAction } from "@/actions/opportunity-moderation";
import { initialFormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type OpportunityModerationItem = {
  id: string;
  title: string;
  type: string;
  ownerName: string | null;
  ownerUsername: string | null;
  status: string;
  moderationStatus: string;
  moderationReason: string | null;
  createdAt: string;
};

type OpportunityModerationFormProps = {
  opportunity: OpportunityModerationItem;
};

export function OpportunityModerationForm({ opportunity }: OpportunityModerationFormProps) {
  const t = useTranslations("moderation");
  const types = useTranslations("opportunityTypes");
  const statuses = useTranslations("opportunityStatuses");
  const moderation = useTranslations("moderationStatuses");
  const [state, formAction, pending] = useActionState(
    moderateOpportunityAction,
    initialFormState,
  );

  function createSubmitter(intent: "approve" | "reject" | "flag") {
    return (formData: FormData) => {
      formData.set("opportunity_id", opportunity.id);
      formData.set("intent", intent);
      formAction(formData);
    };
  }

  return (
    <form action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="opportunity_id" value={opportunity.id} />
      <div className="flex flex-wrap items-center gap-2">
        <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold">{opportunity.title}</span>
      </div>
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p className="truncate">
          {types(opportunity.type as Parameters<typeof types>[0])} ·{" "}
          {statuses(opportunity.status as Parameters<typeof statuses>[0])} ·{" "}
          {moderation(opportunity.moderationStatus as Parameters<typeof moderation>[0])}
        </p>
        <p className="truncate">
          {opportunity.ownerName || opportunity.ownerUsername || "—"} ·{" "}
          {new Date(opportunity.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`opportunity-moderation-reason-${opportunity.id}`}>
          {t("reasonLabel")}
        </Label>
        <Textarea
          id={`opportunity-moderation-reason-${opportunity.id}`}
          name="reason"
          placeholder={t("reasonPlaceholder")}
          maxLength={500}
          rows={2}
        />
      </div>

      {state.status === "success" && <FormMessage status="success">{state.message}</FormMessage>}
      {state.status === "error" && <FormMessage status="error">{state.message}</FormMessage>}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          formAction={createSubmitter("approve")}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />}
          {t("approve")}
        </Button>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending}
          formAction={createSubmitter("reject")}
        >
          <X aria-hidden="true" />
          {t("reject")}
        </Button>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending}
          formAction={createSubmitter("flag")}
        >
          <Flag aria-hidden="true" />
          {t("flag")}
        </Button>
      </div>

      {opportunity.moderationReason && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">{opportunity.moderationReason}</p>
        </div>
      )}
    </form>
  );
}
