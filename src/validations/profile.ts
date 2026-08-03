import { z } from "zod";
import type { ValidationTranslator } from "@/validations/auth";
import {
  COLLABORATION_PREFERENCES,
  MAX_AVAILABILITY,
  MAX_INTERESTS,
  MAX_SKILLS,
  USER_TYPES,
} from "@/profiles/constants";

export function createUsernameSchema(t: ValidationTranslator) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .min(3, t("usernameMin"))
    .max(30, t("usernameMax"))
    .regex(
      /^[a-z0-9_-]+$/,
      t("usernameChars"),
    );
}

function createOptionalUrlSchema(t: ValidationTranslator) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z
      .string()
      .trim()
      .url(t("urlInvalid"))
      .max(2048, t("urlTooLong"))
      .refine(
        (url) => url.startsWith("http://") || url.startsWith("https://"),
        { error: t("urlProtocol") },
      )
      .nullable(),
  );
}

function createRequiredText(t: ValidationTranslator, labelKey: string, min = 2, max = 5000) {
  const label = t(`labels.${labelKey}`);
  return z
    .string()
    .trim()
    .min(min, t("requiredField", { label }))
    .max(max, t("fieldTooLong", { label }));
}

function createNonEmptyStringArray(t: ValidationTranslator, labelKey: string, max: number) {
  const label = t(`labels.${labelKey}`);
  return z
    .array(z.string().trim().min(1, t("emptyItems", { label })))
    .min(1, t("minSelection", { label }))
    .max(max, t("maxItems", { count: max, label }));
}

function createUserTypesSchema(t: ValidationTranslator) {
  return z.array(z.enum(USER_TYPES)).min(1, t("minRole"));
}

function createCollaborationPreferencesSchema(t: ValidationTranslator) {
  return z
    .array(z.enum(COLLABORATION_PREFERENCES))
    .min(1, t("minCollaboration"));
}

function createWeeklyAvailabilitySchema(t: ValidationTranslator) {
  return z.coerce
    .number(t("availabilityNumber"))
    .int(t("availabilityInteger"))
    .min(0, t("availabilityNegative"))
    .max(MAX_AVAILABILITY, t("availabilityMax", { count: MAX_AVAILABILITY }));
}

const isPublicSchema = z.preprocess((value) => value === "on", z.boolean());

export function createOnboardingStepSchemas(t: ValidationTranslator) {
  return {
    1: z.object({
      full_name: createRequiredText(t, "fullName", 2, 80),
      username: createUsernameSchema(t),
      headline: createRequiredText(t, "headline", 2, 120),
      location: createRequiredText(t, "location", 2, 120),
    }),
    2: z.object({
      bio: createRequiredText(t, "bio", 10, 2000),
    }),
    3: z.object({
      user_types: createUserTypesSchema(t),
      weekly_availability: createWeeklyAvailabilitySchema(t),
      collaboration_preferences: createCollaborationPreferencesSchema(t),
    }),
    4: z.object({
      habilidades: createNonEmptyStringArray(t, "skill", MAX_SKILLS),
      intereses: createNonEmptyStringArray(t, "interest", MAX_INTERESTS).refine(
        (items) =>
          new Set(items.map((item) => item.toLowerCase())).size === items.length,
        { error: t("duplicateInterests") },
      ),
      niveles: z.array(z.string()).max(MAX_SKILLS),
    }),
    5: z.object({
      website_url: createOptionalUrlSchema(t),
      linkedin_url: createOptionalUrlSchema(t),
      is_public: isPublicSchema,
    }),
  } as const;
}

export function createUpdateProfileSchema(t: ValidationTranslator) {
  return z.object({
    full_name: createRequiredText(t, "fullName", 2, 80),
    username: createUsernameSchema(t),
    headline: createRequiredText(t, "headline", 2, 120),
    bio: createRequiredText(t, "bio", 10, 2000),
    location: createRequiredText(t, "location", 2, 120),
    user_types: createUserTypesSchema(t),
    weekly_availability: createWeeklyAvailabilitySchema(t),
    collaboration_preferences: createCollaborationPreferencesSchema(t),
    habilidades: createNonEmptyStringArray(t, "skill", MAX_SKILLS),
    intereses: createNonEmptyStringArray(t, "interest", MAX_INTERESTS).refine(
      (items) =>
        new Set(items.map((item) => item.toLowerCase())).size === items.length,
      { error: t("duplicateInterests") },
    ),
    niveles: z.array(z.string()).max(MAX_SKILLS),
    website_url: createOptionalUrlSchema(t),
    linkedin_url: createOptionalUrlSchema(t),
    is_public: isPublicSchema,
  });
}

export type OnboardingStepSchemas = ReturnType<typeof createOnboardingStepSchemas>;
export type OnboardingStepKey = keyof OnboardingStepSchemas;
export type UpdateProfileInput = z.infer<ReturnType<typeof createUpdateProfileSchema>>;
