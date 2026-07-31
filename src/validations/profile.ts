import { z } from "zod";
import {
  COLLABORATION_PREFERENCES,
  MAX_AVAILABILITY,
  MAX_INTERESTS,
  MAX_SKILLS,
  USER_TYPES,
} from "@/profiles/constants";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El username debe tener al menos 3 caracteres.")
  .max(30, "El username no puede superar los 30 caracteres.")
  .regex(
    /^[a-z0-9_-]+$/,
    "Solo letras minúsculas, números, guiones y guiones bajos.",
  );

const optionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .trim()
    .url("Escribe una URL válida, por ejemplo https://...")
    .max(2048, "La URL es demasiado larga.")
    .refine(
      (url) => url.startsWith("http://") || url.startsWith("https://"),
      { error: "La URL debe empezar por http:// o https://." },
    )
    .nullable(),
);

const requiredText = (label: string, min = 2, max = 5000) =>
  z
    .string()
    .trim()
    .min(min, `${label} es obligatorio.`)
    .max(max, `${label} es demasiado largo.`);

const nonEmptyStringArray = (label: string, max: number) =>
  z
    .array(z.string().trim().min(1, `${label} no pueden estar vacíos.`))
    .min(1, `Selecciona al menos un ${label}.`)
    .max(max, `No puedes seleccionar más de ${max} ${label}.`);

const userTypesSchema = z.array(z.enum(USER_TYPES)).min(1, "Selecciona al menos un rol.");
const collaborationPreferencesSchema = z
  .array(z.enum(COLLABORATION_PREFERENCES))
  .min(1, "Selecciona al menos una preferencia de colaboración.");

const weeklyAvailabilitySchema = z
  .coerce
  .number("Escribe la disponibilidad en horas.")
  .int("La disponibilidad debe ser un número entero.")
  .min(0, "La disponibilidad no puede ser negativa.")
  .max(MAX_AVAILABILITY, `La disponibilidad no puede superar ${MAX_AVAILABILITY} horas.`);

const isPublicSchema = z.preprocess((value) => value === "on", z.boolean());

export const onboardingStepSchemas = {
  1: z.object({
    full_name: requiredText("El nombre público", 2, 80),
    username: usernameSchema,
    headline: requiredText("El titular profesional", 2, 120),
    location: requiredText("La ubicación", 2, 120),
  }),
  2: z.object({
    bio: requiredText("La biografía", 10, 2000),
  }),
  3: z.object({
    user_types: userTypesSchema,
    weekly_availability: weeklyAvailabilitySchema,
    collaboration_preferences: collaborationPreferencesSchema,
  }),
  4: z.object({
    habilidades: nonEmptyStringArray("habilidad", MAX_SKILLS),
    intereses: nonEmptyStringArray("interés", MAX_INTERESTS).refine(
      (items) => new Set(items.map((item) => item.toLowerCase())).size === items.length,
      { error: "No puedes repetir intereses." },
    ),
    niveles: z.array(z.string()).max(MAX_SKILLS),
  }),
  5: z.object({
    website_url: optionalUrlSchema,
    linkedin_url: optionalUrlSchema,
    is_public: isPublicSchema,
  }),
} as const;

export type OnboardingStepKey = keyof typeof onboardingStepSchemas;

export const updateProfileSchema = z.object({
  full_name: requiredText("El nombre público", 2, 80),
  username: usernameSchema,
  headline: requiredText("El titular profesional", 2, 120),
  bio: requiredText("La biografía", 10, 2000),
  location: requiredText("La ubicación", 2, 120),
  user_types: userTypesSchema,
  weekly_availability: weeklyAvailabilitySchema,
  collaboration_preferences: collaborationPreferencesSchema,
  habilidades: nonEmptyStringArray("habilidad", MAX_SKILLS),
  intereses: nonEmptyStringArray("interés", MAX_INTERESTS).refine(
    (items) => new Set(items.map((item) => item.toLowerCase())).size === items.length,
    { error: "No puedes repetir intereses." },
  ),
  niveles: z.array(z.string()).max(MAX_SKILLS),
  website_url: optionalUrlSchema,
  linkedin_url: optionalUrlSchema,
  is_public: isPublicSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
