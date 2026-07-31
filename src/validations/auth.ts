import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede superar los 72 caracteres.")
  .regex(/[a-z]/, "Debe incluir al menos una letra minúscula.")
  .regex(/[A-Z]/, "Debe incluir al menos una letra mayúscula.")
  .regex(/[0-9]/, "Debe incluir al menos un número.");

export const signUpSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, "Escribe tu nombre y apellidos.")
      .max(80, "El nombre es demasiado largo."),
    correo: z.email("Escribe un correo válido.").max(254, "El correo es demasiado largo.").toLowerCase(),
    contrasena: passwordSchema,
    confirmarContrasena: z.string(),
    terminos: z.literal("on", { error: "Debes aceptar los términos y condiciones." }),
  })
  .refine((datos) => datos.contrasena === datos.confirmarContrasena, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmarContrasena"],
  });

export const signInSchema = z.object({
  correo: z.email("Escribe un correo válido.").max(254, "El correo es demasiado largo.").toLowerCase(),
  contrasena: z.string().min(1, "Escribe tu contraseña.").max(72, "La contraseña es demasiado larga."),
  recordar: z.preprocess((valor) => valor === "on", z.boolean()),
});

export const requestPasswordResetSchema = z.object({
  correo: z.email("Escribe un correo válido.").max(254, "El correo es demasiado largo.").toLowerCase(),
});

export const updatePasswordSchema = z
  .object({
    contrasena: passwordSchema,
    confirmarContrasena: z.string(),
  })
  .refine((datos) => datos.contrasena === datos.confirmarContrasena, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmarContrasena"],
  });
