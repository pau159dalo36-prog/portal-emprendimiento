"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, Send } from "lucide-react";

import { saveServiceAction } from "@/actions/service";
import { initialFormState, type FormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SERVICE_CATEGORIES,
  SERVICE_DELIVERY_MODES,
  SERVICE_PRICING_TYPES,
  SERVICE_VISIBILITIES,
} from "@/services/constants";
import {
  emptyServiceFormData,
  type ServiceFormData,
} from "@/services/map";

type ServiceFormProps = {
  mode: "create" | "edit";
  initial?: ServiceFormData;
  serviceId?: string;
};

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const VISIBILITY_LABELS: Record<string, string> = {
  public: "public",
  registered_users: "registeredUsers",
};

// Formulario de servicio (crear/editar). El pricing_type decide qué campos de
// precio se muestran y se envían; el resto se limpia al cambiar de tipo para
// que el payload siempre encaje con el CHECK services_pricing_shape_check.
export function ServiceForm({ mode, initial, serviceId }: ServiceFormProps) {
  const t = useTranslations("serviceForm");
  const servicesT = useTranslations("services");

  const [state, formAction, pending] = useActionState(saveServiceAction, initialFormState);
  const [draft, setDraft] = useState<ServiceFormData>(
    () => initial ?? emptyServiceFormData,
  );

  const withAmount = draft.pricing_type === "fixed" || draft.pricing_type === "hourly";
  const withRange = draft.pricing_type === "range";

  function set<K extends keyof ServiceFormData>(key: K, value: ServiceFormData[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {mode === "edit" && serviceId && (
        <input type="hidden" name="service_id" value={serviceId} />
      )}
      <input type="hidden" name="status" value="draft" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="title">{t("titleLabel")}</Label>
          <Input
            id="title"
            name="title"
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
            aria-invalid={Boolean(fieldError(state, "title"))}
            placeholder={t("titlePlaceholder")}
          />
          {fieldError(state, "title") && (
            <p className="text-sm text-destructive">{fieldError(state, "title")}</p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="description">{t("descriptionLabel")}</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
            aria-invalid={Boolean(fieldError(state, "description"))}
            placeholder={t("descriptionPlaceholder")}
          />
          {fieldError(state, "description") && (
            <p className="text-sm text-destructive">{fieldError(state, "description")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="category">{t("categoryLabel")}</Label>
          <select
            id="category"
            name="category"
            value={draft.category}
            onChange={(event) => set("category", event.target.value)}
            className={selectClassName}
          >
            {SERVICE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {servicesT(`categories.${value}` as never)}
              </option>
            ))}
          </select>
          {fieldError(state, "category") && (
            <p className="text-sm text-destructive">{fieldError(state, "category")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="delivery_mode">{t("deliveryModeLabel")}</Label>
          <select
            id="delivery_mode"
            name="delivery_mode"
            value={draft.delivery_mode}
            onChange={(event) => set("delivery_mode", event.target.value)}
            className={selectClassName}
          >
            {SERVICE_DELIVERY_MODES.map((value) => (
              <option key={value} value={value}>
                {servicesT(`deliveryModes.${value}` as never)}
              </option>
            ))}
          </select>
          {fieldError(state, "delivery_mode") && (
            <p className="text-sm text-destructive">{fieldError(state, "delivery_mode")}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pricing_type">{t("pricingTypeLabel")}</Label>
          <select
            id="pricing_type"
            name="pricing_type"
            value={draft.pricing_type}
            onChange={(event) => {
              const value = event.target.value;
              setDraft((d) => {
                const next = { ...d, pricing_type: value };
                if (value !== "fixed" && value !== "hourly" && value !== "range") {
                  next.price_amount = "";
                  next.price_min = "";
                  next.price_max = "";
                  next.currency = "";
                }
                if (value !== "fixed" && value !== "hourly") {
                  next.price_amount = "";
                }
                return next;
              });
            }}
            className={selectClassName}
          >
            {SERVICE_PRICING_TYPES.map((value) => (
              <option key={value} value={value}>
                {servicesT(`pricingTypes.${value}` as never)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {t(withAmount ? "pricingAmountHint" : withRange ? "pricingRangeHint" : draft.pricing_type === "free" ? "pricingFreeHint" : "pricingNegotiableHint")}
          </p>
          {fieldError(state, "pricing_type") && (
            <p className="text-sm text-destructive">{fieldError(state, "pricing_type")}</p>
          )}
        </div>

        {withAmount && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="price_amount">
                {t(draft.pricing_type === "hourly" ? "pricePerHourLabel" : "priceAmountLabel")}
              </Label>
              <Input
                id="price_amount"
                name="price_amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={draft.price_amount}
                onChange={(event) => set("price_amount", event.target.value)}
                aria-invalid={Boolean(fieldError(state, "price_amount"))}
              />
              {fieldError(state, "price_amount") && (
                <p className="text-sm text-destructive">{fieldError(state, "price_amount")}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currency">{t("currencyLabel")}</Label>
              <select
                id="currency"
                name="currency"
                value={draft.currency}
                onChange={(event) => set("currency", event.target.value)}
                className={selectClassName}
              >
                <option value="">{t("currencyNone")}</option>
                {(["EUR", "USD", "MXN", "ARS", "COP", "CLP", "PEN", "BRL"] as const).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              {fieldError(state, "currency") && (
                <p className="text-sm text-destructive">{fieldError(state, "currency")}</p>
              )}
            </div>
          </>
        )}

        {withRange && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="price_min">{t("priceMinLabel")}</Label>
              <Input
                id="price_min"
                name="price_min"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={draft.price_min}
                onChange={(event) => set("price_min", event.target.value)}
                aria-invalid={Boolean(fieldError(state, "price_min"))}
              />
              {fieldError(state, "price_min") && (
                <p className="text-sm text-destructive">{fieldError(state, "price_min")}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price_max">{t("priceMaxLabel")}</Label>
              <Input
                id="price_max"
                name="price_max"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={draft.price_max}
                onChange={(event) => set("price_max", event.target.value)}
                aria-invalid={Boolean(fieldError(state, "price_max"))}
              />
              {fieldError(state, "price_max") && (
                <p className="text-sm text-destructive">{fieldError(state, "price_max")}</p>
              )}
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="currency">{t("currencyLabel")}</Label>
              <select
                id="currency"
                name="currency"
                value={draft.currency}
                onChange={(event) => set("currency", event.target.value)}
                className={selectClassName}
              >
                <option value="">{t("currencyNone")}</option>
                {(["EUR", "USD", "MXN", "ARS", "COP", "CLP", "PEN", "BRL"] as const).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              {fieldError(state, "currency") && (
                <p className="text-sm text-destructive">{fieldError(state, "currency")}</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="visibility">{t("visibilityLabel")}</Label>
          <select
            id="visibility"
            name="visibility"
            value={draft.visibility}
            onChange={(event) => set("visibility", event.target.value)}
            className={selectClassName}
          >
            {SERVICE_VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {t(`visibility.${VISIBILITY_LABELS[value]}`)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("visibilityHint")}</p>
          {fieldError(state, "visibility") && (
            <p className="text-sm text-destructive">{fieldError(state, "visibility")}</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 border-t border-border pt-6 sm:grid-cols-[1fr_auto_auto]">
        <FormMessage status={state.status === "idle" ? undefined : state.status}>
          {state.status === "idle" ? undefined : state.message}
        </FormMessage>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <Button type="submit" name="intent" value="save" disabled={pending} variant="outline">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {t("saveButton")}
          </Button>
          <Button type="submit" name="intent" value="publish" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {t("publishButton")}
          </Button>
        </div>
      </div>
    </form>
  );
}
