"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { signInAction } from "@/actions/auth";
import { initialAuthFormState } from "@/actions/auth-state";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";

export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialAuthFormState);
  const t = useTranslations("authForm");

  return (
    <form action={formAction} noValidate className="grid gap-4">
      {state.message && (
        <FormMessage status={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="correo">{t("email")}</Label>
        <Input
          id="correo"
          name="correo"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          required
          aria-invalid={Boolean(state.fieldErrors?.correo)}
          aria-describedby={state.fieldErrors?.correo ? "error-correo" : undefined}
        />
        {state.fieldErrors?.correo && (
          <p id="error-correo" className="text-sm text-destructive">
            {state.fieldErrors.correo[0]}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="contrasena">{t("password")}</Label>
          <Link
            href="/recuperar-contrasena"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        <Input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          required
          aria-invalid={Boolean(state.fieldErrors?.contrasena)}
          aria-describedby={state.fieldErrors?.contrasena ? "error-contrasena" : undefined}
        />
        {state.fieldErrors?.contrasena && (
          <p id="error-contrasena" className="text-sm text-destructive">
            {state.fieldErrors.contrasena[0]}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="recordar" name="recordar" value="on" defaultChecked className="mt-0.5" />
        <Label htmlFor="recordar" className="leading-6 font-normal">
          {t("remember")}
        </Label>
      </div>

      <SubmitButton className="mt-2 w-full" pendingText={t("signInPending")}>
        {t("signInSubmit")}
      </SubmitButton>
    </form>
  );
}
