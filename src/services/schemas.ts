import { z } from "zod";

import {
  CURRENCIES,
  SERVICE_CATEGORIES,
  SERVICE_CURRENCY_PATTERN,
  SERVICE_DELIVERY_MODES,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_DESCRIPTION_MIN_LENGTH,
  SERVICE_MAX_PRICE_VALUE,
  SERVICE_PRICING_TYPES,
  SERVICE_STATUSES,
  SERVICE_TITLE_MAX_LENGTH,
  SERVICE_TITLE_MIN_LENGTH,
  SERVICE_VISIBILITIES,
  isAmountPricing,
  isRangePricing,
} from "@/services/constants";
import type { ValidationTranslator } from "@/validations/auth";

function emptyToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

// "1250,50" | "1250.50" → number. Un valor no numérico pasa tal cual para que
// el refine lo rechace con mensaje claro.
function toNumberOrKeep(value: unknown): unknown {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

function priceNumber(invalidKey: string, t: ValidationTranslator) {
  return z.preprocess(
    toNumberOrKeep,
    z
      .number({ error: t(invalidKey) })
      .min(0, t(invalidKey))
      .max(SERVICE_MAX_PRICE_VALUE, t(invalidKey))
      .nullable(),
  );
}

// Crea el esquema de un servicio. La forma exacta de los campos de precio la
// fija pricing_type (espejo del CHECK services_pricing_shape_check de la BD):
// fixed/hourly → price_amount + moneda; range → min/max (min <= max) + moneda;
// negotiable/free → sin cantidades ni moneda. El transform deja el payload
// listo para INSERT/UPDATE directo en `services`.
export function createServiceSchema(t: ValidationTranslator) {
  const base = z.object({
    title: z
      .string()
      .trim()
      .min(SERVICE_TITLE_MIN_LENGTH, t("titleTooShort"))
      .max(SERVICE_TITLE_MAX_LENGTH, t("titleTooLong")),
    description: z
      .string()
      .trim()
      .min(SERVICE_DESCRIPTION_MIN_LENGTH, t("descriptionTooShort"))
      .max(SERVICE_DESCRIPTION_MAX_LENGTH, t("descriptionTooLong")),
    category: z.enum(SERVICE_CATEGORIES, { error: t("categoryInvalid") }),
    delivery_mode: z.enum(SERVICE_DELIVERY_MODES, { error: t("deliveryModeInvalid") }),
    pricing_type: z.enum(SERVICE_PRICING_TYPES, { error: t("pricingTypeInvalid") }),
    status: z.enum(["draft", "published"], { error: t("statusInvalid") }),
    visibility: z.enum(SERVICE_VISIBILITIES, { error: t("visibilityInvalid") }),
    price_amount: priceNumber("amountInvalid", t),
    price_min: priceNumber("minInvalid", t),
    price_max: priceNumber("maxInvalid", t),
    currency: z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(SERVICE_CURRENCY_PATTERN, t("currencyInvalid"))
        .nullable(),
    ),
  });

  return base
    .superRefine((data, ctx) => {
      if (isAmountPricing(data.pricing_type)) {
        if (data.price_amount === null) {
          ctx.addIssue({
            code: "custom",
            path: ["price_amount"],
            message: t("amountRequired"),
          });
        }
        if (data.currency === null) {
          ctx.addIssue({
            code: "custom",
            path: ["currency"],
            message: t("currencyRequired"),
          });
        }
      } else if (isRangePricing(data.pricing_type)) {
        if (data.price_min === null || data.price_max === null) {
          ctx.addIssue({
            code: "custom",
            path: ["price_min"],
            message: t("rangeRequired"),
          });
        }
        if (
          data.price_min !== null &&
          data.price_max !== null &&
          data.price_min > data.price_max
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["price_max"],
            message: t("maxBelowMin"),
          });
        }
        if (data.currency === null) {
          ctx.addIssue({
            code: "custom",
            path: ["currency"],
            message: t("currencyRequired"),
          });
        }
      } else if (data.price_amount !== null || data.price_min !== null || data.price_max !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["price_amount"],
          message: t("noAmountsForType"),
        });
      }
    })
    .transform((data) => {
      const withAmount = isAmountPricing(data.pricing_type);
      const withRange = isRangePricing(data.pricing_type);
      return {
        ...data,
        price_amount: withAmount ? data.price_amount : null,
        price_min: withRange ? data.price_min : null,
        price_max: withRange ? data.price_max : null,
        currency:
          withAmount || withRange ? data.currency : null,
      };
    });
}

export function createServiceStatusSchema(t: ValidationTranslator) {
  return z.enum(SERVICE_STATUSES, { error: t("statusInvalid") });
}

export type ServiceInput = z.infer<ReturnType<typeof createServiceSchema>>;

// Monedas ofrecidas por el formulario (reexport para selects).
export const SERVICE_FORM_CURRENCIES = CURRENCIES;
