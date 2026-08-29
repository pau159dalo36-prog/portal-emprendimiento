"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, Flag, Loader2, ShieldAlert, X } from "lucide-react";

import { moderateServiceAction } from "@/actions/service-moderation";
import { initialFormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ServiceModerationItem = {
  id: string;
  title: string;
  description: string;
  providerName: string | null;
  providerUsername: string | null;
  visibility: string;
  moderationStatus: string;
  moderationReason: string | null;
  createdAt: string;
};

type ServiceModerationFormProps = {
  service: ServiceModerationItem;
};

export function ServiceModerationForm({ service }: ServiceModerationFormProps) {
  const t = useTranslations("serviceModeration");
  const [state, formAction, pending] = useActionState(moderateServiceAction, initialFormState);

  function createSubmitter(intent: "approve" | "reject" | "flag") {
    return (formData: FormData) => {
      formData.set("service_id", service.id);
      formData.set("intent", intent);
      formAction(formData);
    };
  }

  return (
    <form action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="service_id" value={service.id} />
      <div className="flex flex-wrap items-center gap-2">
        <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold">{service.title}</span>
      </div>
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p className="line-clamp-2">{service.description || "—"}</p>
        <p className="truncate">
          {service.providerName || service.providerUsername || "—"} · {service.visibility} ·{" "}
          {new Date(service.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`service-moderation-reason-${service.id}`}>{t("reasonLabel")}</Label>
        <Textarea
          id={`service-moderation-reason-${service.id}`}
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

      {service.moderationReason && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">{service.moderationReason}</p>
        </div>
      )}
    </form>
  );
}