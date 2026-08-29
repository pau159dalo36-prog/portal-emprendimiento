"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, Loader2 } from "lucide-react";

import { submitReportAction } from "@/actions/reports";
import { initialFormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASONS, type ReportTargetType } from "@/reports/config";

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

type ReportButtonProps = {
  targetType: ReportTargetType;
  targetId: string;
};

export function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const t = useTranslations("reports");
  const [state, formAction, pending] = useActionState(submitReportAction, initialFormState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Flag className="size-4" aria-hidden="true" />
        {t("button")}
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      className="grid w-full gap-2 rounded-xl border border-border/60 bg-card p-3"
    >
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />

      <div className="grid gap-1.5">
        <Label htmlFor={`report-reason-${targetType}-${targetId}`}>{t("reasonLabel")}</Label>
        <select
          id={`report-reason-${targetType}-${targetId}`}
          name="reason"
          required
          defaultValue="inappropriate"
          className={selectClassName}
        >
          {REPORT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {t(`reasons.${reason}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`report-note-${targetType}-${targetId}`}>{t("noteLabel")}</Label>
        <Textarea
          id={`report-note-${targetType}-${targetId}`}
          name="note"
          placeholder={t("notePlaceholder")}
          maxLength={2000}
          rows={2}
        />
      </div>

      {state.status === "success" && <FormMessage status="success">{state.message}</FormMessage>}
      {state.status === "error" && <FormMessage status="error">{state.message}</FormMessage>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Flag aria-hidden="true" />}
          {t("submit")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}