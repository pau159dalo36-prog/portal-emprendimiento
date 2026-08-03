import { z } from "zod";
import type { ValidationTranslator } from "@/validations/auth";

export function createOptionalUrlSchema(t: ValidationTranslator) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z
      .string()
      .trim()
      .url(t("urlInvalid"))
      .max(2048, t("urlTooLong"))
      .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
        error: t("urlProtocol"),
      })
      .nullable(),
  );
}

export function createOptionalTextSchema(
  t: ValidationTranslator,
  labelKey: string,
  max: number,
) {
  const label = t(`labels.${labelKey}`);
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max, t("fieldTooLong", { label })).nullable(),
  );
}

export function createRequiredTextSchema(
  t: ValidationTranslator,
  labelKey: string,
  min: number,
  max: number,
) {
  const label = t(`labels.${labelKey}`);
  return z
    .string()
    .trim()
    .min(min, t("requiredField", { label }))
    .max(max, t("fieldTooLong", { label }));
}

export function createSlugSchema(
  t: ValidationTranslator,
  options: { min: number; max: number; minKey: string; maxKey: string; charsKey: string },
) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .min(options.min, t(options.minKey))
    .max(options.max, t(options.maxKey))
    .regex(/^[a-z0-9_-]+$/, t(options.charsKey));
}

export function createEnumArraySchema<T extends readonly [string, ...string[]]>(values: T) {
  return z.array(z.enum(values));
}

export const createIsCheckedSchema = () =>
  z.preprocess((value) => value === "on", z.boolean());
