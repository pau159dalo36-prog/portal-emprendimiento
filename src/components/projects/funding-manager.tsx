"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save } from "lucide-react";

import type { FormState } from "@/actions/form-state";
import { initialFormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FUNDING_STAGES,
} from "@/projects/constants";

type FundingManagerProps = {
  projectId: string;
  canManage: boolean;
  initial?: {
    seeking_investment: boolean;
    funding_stage: string | null;
    amount_sought: number | null;
    investment_currency: string | null;
    investment_note: string | null;
  };
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
};

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const FUNDING_CURRENCIES = ["EUR", "USD", "MXN", "ARS", "COP", "CLP", "PEN", "BRL"] as const;

// Señal de inversión (FASE 7): solo informativa. El flag decide si el resto
// de campos se envía; al apagarlo la acción limpia todo a NULL.
export function FundingManager({ projectId, canManage, initial, action }: FundingManagerProps) {
  const t = useTranslations("funding");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const seeking = initial?.seeking_investment ?? false;

  if (!canManage && !seeking) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {!canManage ? (
        <ul className="grid gap-2">
          {initial?.funding_stage && (
            <li className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{t("stageLabel")}</span>
              <span>{t(`stages.${initial.funding_stage}` as never)}</span>
            </li>
          )}
          {initial?.amount_sought != null && (
            <li className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{t("amountLabel")}</span>
              <span className="font-medium">
                {new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(
                  Number(initial.amount_sought),
                )}
                {initial.investment_currency ? ` ${initial.investment_currency}` : ""}
              </span>
            </li>
          )}
          {initial?.investment_note && (
            <li className="whitespace-pre-line text-sm text-muted-foreground">
              {initial.investment_note}
            </li>
          )}
        </ul>
      ) : (
        <form action={formAction} noValidate className="grid gap-4">
          <input type="hidden" name="project_id" value={projectId} />

          <label className="flex items-center gap-3 rounded-lg border border-border p-4">
            <input
              type="checkbox"
              name="seeking_investment"
              defaultChecked={seeking}
              className="size-4 rounded border-border accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">{t("seekingLabel")}</span>
              <span className="block text-xs text-muted-foreground">{t("seekingHint")}</span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="funding_stage">{t("stageLabel")}</Label>
              <select
                id="funding_stage"
                name="funding_stage"
                defaultValue={initial?.funding_stage ?? ""}
                className={selectClassName}
              >
                <option value="">{t("stageNone")}</option>
                {FUNDING_STAGES.map((value) => (
                  <option key={value} value={value}>
                    {t(`stages.${value}` as never)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount_sought">{t("amountLabel")}</Label>
              <Input
                id="amount_sought"
                name="amount_sought"
                type="number"
                min={0}
                inputMode="decimal"
                defaultValue={initial?.amount_sought != null ? String(initial.amount_sought) : ""}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="investment_currency">{t("currencyLabel")}</Label>
              <select
                id="investment_currency"
                name="investment_currency"
                defaultValue={initial?.investment_currency ?? ""}
                className={selectClassName}
              >
                <option value="">{t("currencyNone")}</option>
                {FUNDING_CURRENCIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="investment_note">{t("noteLabel")}</Label>
            <Textarea
              id="investment_note"
              name="investment_note"
              rows={3}
              defaultValue={initial?.investment_note ?? ""}
              placeholder={t("notePlaceholder")}
            />
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
