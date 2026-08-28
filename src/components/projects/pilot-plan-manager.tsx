"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FlaskConical, Loader2, Save } from "lucide-react";

import type { FormState } from "@/actions/form-state";
import { initialFormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PilotPlanManagerProps = {
  projectId: string;
  canManage: boolean;
  initial?: {
    what_to_test: string;
    target_user_profile: string | null;
    tester_expectations: string | null;
    incentive_note: string | null;
    slots_total: number | null;
  } | null;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
};

// Plan de primeros usuarios / testers (FASE 7): declaración simple pública.
// Sin sistema de testing complejo; el contacto es vía mensajería 1:1.
export function PilotPlanManager({ projectId, canManage, initial, action }: PilotPlanManagerProps) {
  const t = useTranslations("pilotUsers");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  if (!canManage && !initial) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FlaskConical className="size-5" aria-hidden="true" />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {!canManage ? (
        initial && (
          <ul className="grid gap-2">
            <li className="whitespace-pre-line text-sm">{initial.what_to_test}</li>
            {initial.target_user_profile && (
              <li className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t("targetProfileLabel")}: </span>
                {initial.target_user_profile}
              </li>
            )}
            {initial.tester_expectations && (
              <li className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t("expectationsLabel")}: </span>
                {initial.tester_expectations}
              </li>
            )}
            {initial.incentive_note && (
              <li className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t("incentiveLabel")}: </span>
                {initial.incentive_note}
              </li>
            )}
            {initial.slots_total != null && (
              <li className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t("slotsLabel")}: </span>
                {initial.slots_total}
              </li>
            )}
          </ul>
        )
      ) : (
        <form action={formAction} noValidate className="grid gap-4">
          <input type="hidden" name="project_id" value={projectId} />

          <div className="grid gap-2">
            <Label htmlFor="what_to_test">{t("whatToTestLabel")}</Label>
            <Textarea
              id="what_to_test"
              name="what_to_test"
              rows={3}
              defaultValue={initial?.what_to_test ?? ""}
              placeholder={t("whatToTestPlaceholder")}
              aria-invalid={Boolean(fieldError(state, "what_to_test"))}
            />
            {fieldError(state, "what_to_test") && (
              <p className="text-sm text-destructive">{fieldError(state, "what_to_test")}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="target_user_profile">{t("targetProfileLabel")}</Label>
            <Input
              id="target_user_profile"
              name="target_user_profile"
              defaultValue={initial?.target_user_profile ?? ""}
              placeholder={t("targetProfilePlaceholder")}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tester_expectations">{t("expectationsLabel")}</Label>
            <Textarea
              id="tester_expectations"
              name="tester_expectations"
              rows={2}
              defaultValue={initial?.tester_expectations ?? ""}
              placeholder={t("expectationsPlaceholder")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <div className="grid gap-2">
              <Label htmlFor="incentive_note">{t("incentiveLabel")}</Label>
              <Input
                id="incentive_note"
                name="incentive_note"
                defaultValue={initial?.incentive_note ?? ""}
                placeholder={t("incentivePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slots_total">{t("slotsLabel")}</Label>
              <Input
                id="slots_total"
                name="slots_total"
                type="number"
                min={1}
                defaultValue={initial?.slots_total != null ? String(initial.slots_total) : ""}
                aria-invalid={Boolean(fieldError(state, "slots_total"))}
              />
              {fieldError(state, "slots_total") && (
                <p className="text-sm text-destructive">{fieldError(state, "slots_total")}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto]">
            <FormMessage status={state.status === "idle" ? undefined : state.status}>
              {state.status === "idle" ? undefined : state.message}
            </FormMessage>
            <Button type="submit" disabled={pending} className="sm:justify-self-end">
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {t("saveButton")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}
