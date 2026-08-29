"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, X } from "lucide-react";

import { resolveReportAction } from "@/actions/reports";
import { initialFormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AdminReportFormProps = {
  reportId: string;
};

export function AdminReportForm({ reportId }: AdminReportFormProps) {
  const t = useTranslations("adminReports");
  const [state, formAction, pending] = useActionState(resolveReportAction, initialFormState);

  function createSubmitter(status: "resolved" | "dismissed") {
    return (formData: FormData) => {
      formData.set("report_id", reportId);
      formData.set("status", status);
      formAction(formData);
    };
  }

  return (
    <form action={formAction} noValidate className="grid gap-2">
      <input type="hidden" name="report_id" value={reportId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`resolution-note-${reportId}`}>{t("resolutionLabel")}</Label>
        <Textarea
          id={`resolution-note-${reportId}`}
          name="resolution_note"
          placeholder={t("resolutionPlaceholder")}
          maxLength={2000}
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
          formAction={createSubmitter("resolved")}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          {t("resolve")}
        </Button>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending}
          formAction={createSubmitter("dismissed")}
        >
          <X aria-hidden="true" />
          {t("dismiss")}
        </Button>
      </div>
    </form>
  );
}