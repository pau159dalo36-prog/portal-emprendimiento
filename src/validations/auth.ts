import { z } from "zod";

export type ValidationTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function createPasswordSchema(t: ValidationTranslator) {
  return z
    .string()
    .min(8, t("passwordMin"))
    .max(72, t("passwordMax"))
    .regex(/[a-z]/, t("passwordLower"))
    .regex(/[A-Z]/, t("passwordUpper"))
    .regex(/[0-9]/, t("passwordNumber"));
}

export function createSignUpSchema(t: ValidationTranslator) {
  return z
    .object({
      nombre: z
        .string()
        .trim()
        .min(2, t("nameMin"))
        .max(80, t("nameMax")),
      correo: z.email(t("emailInvalid")).max(254, t("emailMax")).toLowerCase(),
      contrasena: createPasswordSchema(t),
      confirmarContrasena: z.string(),
      terminos: z.literal("on", { error: t("termsRequired") }),
    })
    .refine((datos) => datos.contrasena === datos.confirmarContrasena, {
      error: t("passwordsMismatch"),
      path: ["confirmarContrasena"],
    });
}

export function createSignInSchema(t: ValidationTranslator) {
  return z.object({
    correo: z.email(t("emailInvalid")).max(254, t("emailMax")).toLowerCase(),
    contrasena: z
      .string()
      .min(1, t("passwordRequired"))
      .max(72, t("passwordTooLong")),
    recordar: z.preprocess((valor) => valor === "on", z.boolean()),
  });
}

export function createRequestPasswordResetSchema(t: ValidationTranslator) {
  return z.object({
    correo: z.email(t("emailInvalid")).max(254, t("emailMax")).toLowerCase(),
  });
}

export function createUpdatePasswordSchema(t: ValidationTranslator) {
  return z
    .object({
      contrasena: createPasswordSchema(t),
      confirmarContrasena: z.string(),
    })
    .refine((datos) => datos.contrasena === datos.confirmarContrasena, {
      error: t("passwordsMismatch"),
      path: ["confirmarContrasena"],
    });
}
