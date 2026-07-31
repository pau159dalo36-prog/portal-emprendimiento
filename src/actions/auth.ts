"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthUnknownError, isAuthError } from "@supabase/supabase-js";
import type { AuthFormState } from "@/actions/auth-state";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginDestination } from "@/profiles/destination";
import {
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/validations/auth";

type AuthLogEntry = {
  action: string;
  name?: string;
  code?: string;
  status?: number;
  message?: string;
  cause?: { name?: string; message?: string };
};

function logSignUpError(error: unknown): void {
  const { code, status, message } = isAuthError(error)
    ? error
    : error instanceof Error
      ? { code: undefined, status: undefined, message: error.message }
      : { code: undefined, status: undefined, message: undefined };

  console.error("[auth:signup]", JSON.stringify({ code, status, message }));
}

function logAuthError(action: string, error: unknown): void {
  const entry: AuthLogEntry = { action };

  if (isAuthError(error)) {
    entry.name = error.name;
    entry.code = error.code;
    entry.status = error.status;
    entry.message = error.message;

    if (error instanceof AuthUnknownError && error.originalError instanceof Error) {
      entry.cause = {
        name: error.originalError.name,
        message: error.originalError.message,
      };
    }
  } else if (error instanceof Error) {
    entry.name = error.name;
    entry.message = error.message;
  }

  console.error("[auth:error]", JSON.stringify(entry));
}

function validationResult(
  error: z.ZodError,
  message = "Revisa los campos marcados.",
): AuthFormState {
  return {
    status: "error",
    message,
    fieldErrors: error.flatten().fieldErrors,
  };
}

export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    nombre: formData.get("nombre"),
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
    confirmarContrasena: formData.get("confirmar-contrasena"),
    terminos: formData.get("terminos"),
  });

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.correo,
    password: parsed.data.contrasena,
    options: {
      data: { full_name: parsed.data.nombre },
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    logSignUpError(error);
    return {
      status: "error",
      message: "No se pudo crear la cuenta. Inténtalo de nuevo.",
    };
  }

  if (data.session && data.user) {
    redirect(await getPostLoginDestination(supabase, data.user.id));
  }

  redirect("/verificar-correo");
}

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
    recordar: formData.get("recordar"),
  });

  if (!parsed.success) {
    return validationResult(parsed.error, "El correo o la contraseña no son válidos.");
  }

  const supabase = await createClient({ persistent: parsed.data.recordar });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.correo,
    password: parsed.data.contrasena,
  });

  if (error || !data.session) {
    logAuthError("signIn", error);
    return {
      status: "error",
      message: "El correo o la contraseña son incorrectos.",
    };
  }

  redirect(await getPostLoginDestination(supabase, data.session.user.id));
}

export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = requestPasswordResetSchema.safeParse({
    correo: formData.get("correo"),
  });

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(parsed.data.correo, {
    redirectTo: `${getSiteUrl()}/auth/reset-password`,
  });

  return {
    status: "success",
    message:
      "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.",
  };
}

export async function updatePasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = updatePasswordSchema.safeParse({
    contrasena: formData.get("contrasena"),
    confirmarContrasena: formData.get("confirmar-contrasena"),
  });

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.updateUser({
    password: parsed.data.contrasena,
  });

  if (error || !data.user) {
    logAuthError("updatePassword", error);
    return {
      status: "error",
      message: "No se pudo actualizar la contraseña. Vuelve a intentarlo.",
    };
  }

  await supabase.auth.signOut({ scope: "global" });

  redirect("/iniciar-sesion?contrasena=actualizada");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient({ persistent: false });

  await supabase.auth.signOut({ scope: "global" });

  redirect("/");
}
