"use server";

import { z } from "zod";
import { AuthUnknownError, isAuthError } from "@supabase/supabase-js";
import { getLocale, getTranslations } from "next-intl/server";
import type { AuthFormState } from "@/actions/auth-state";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginDestination } from "@/profiles/destination";
import {
  createRequestPasswordResetSchema,
  createSignInSchema,
  createSignUpSchema,
  createUpdatePasswordSchema,
} from "@/validations/auth";
import { getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";

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
  t: (key: string, values?: Record<string, string | number>) => string,
  error: z.ZodError,
  message?: string,
): AuthFormState {
  return {
    status: "error",
    message: message ?? t("validationGeneral"),
    fieldErrors: error.flatten().fieldErrors,
  };
}

export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.auth");

  const parsed = createSignUpSchema(t).safeParse({
    nombre: formData.get("nombre"),
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
    confirmarContrasena: formData.get("confirmar-contrasena"),
    terminos: formData.get("terminos"),
  });

  if (!parsed.success) {
    return validationResult(ta, parsed.error);
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
      message: ta("signUpFailed"),
    };
  }

  if (data.session && data.user) {
    const destination = await getPostLoginDestination(supabase, data.user.id);
    redirect(getPathname({ href: destination, locale }));
  }

  redirect(getPathname({ href: "/verificar-correo", locale }));
}

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.auth");

  const parsed = createSignInSchema(t).safeParse({
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
    recordar: formData.get("recordar"),
  });

  if (!parsed.success) {
    return validationResult(ta, parsed.error, ta("signInInvalid"));
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
      message: ta("signInFailed"),
    };
  }

  const destination = await getPostLoginDestination(supabase, data.session.user.id);
  redirect(getPathname({ href: destination, locale }));
}

export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.auth");

  const parsed = createRequestPasswordResetSchema(t).safeParse({
    correo: formData.get("correo"),
  });

  if (!parsed.success) {
    return validationResult(ta, parsed.error);
  }

  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(parsed.data.correo, {
    redirectTo: `${getSiteUrl()}/auth/reset-password`,
  });

  return {
    status: "success",
    message: ta("resetSent"),
  };
}

export async function updatePasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.auth");

  const parsed = createUpdatePasswordSchema(t).safeParse({
    contrasena: formData.get("contrasena"),
    confirmarContrasena: formData.get("confirmar-contrasena"),
  });

  if (!parsed.success) {
    return validationResult(ta, parsed.error);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.updateUser({
    password: parsed.data.contrasena,
  });

  if (error || !data.user) {
    logAuthError("updatePassword", error);
    return {
      status: "error",
      message: ta("updateFailed"),
    };
  }

  await supabase.auth.signOut({ scope: "global" });

  redirect(
    getPathname({
      href: { pathname: "/iniciar-sesion", query: { contrasena: "actualizada" } },
      locale,
    }),
  );
}

export async function signOutAction(): Promise<void> {
  const locale = await getLocale();
  const supabase = await createClient({ persistent: false });

  await supabase.auth.signOut({ scope: "global" });

  redirect(getPathname({ href: "/", locale }));
}
