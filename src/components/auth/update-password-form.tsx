"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { updatePasswordAction } from "@/actions/auth";
import { initialAuthFormState } from "@/actions/auth-state";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialAuthFormState);
  const t = useTranslations("authForm");

  return (
    <form action={formAction} noValidate className="grid gap-4">
      {state.message && (
        <FormMessage status={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="contrasena">{t("newPassword")}</Label>
        <Input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="new-password"
          placeholder={t("passwordMinPlaceholder")}
          required
          aria-invalid={Boolean(state.fieldErrors?.contrasena)}
          aria-describedby={
            state.fieldErrors?.contrasena ? "error-contrasena" : "ayuda-contrasena"
          }
        />
        <p id="ayuda-contrasena" className="text-sm text-muted-foreground">
          {t("passwordHelp")}
        </p>
        {state.fieldErrors?.contrasena && (
          <p id="error-contrasena" className="text-sm text-destructive">
            {state.fieldErrors.contrasena[0]}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="confirmar-contrasena">{t("confirmNewPassword")}</Label>
        <Input
          id="confirmar-contrasena"
          name="confirmar-contrasena"
          type="password"
          autoComplete="new-password"
          placeholder={t("confirmPasswordPlaceholder")}
          required
          aria-invalid={Boolean(state.fieldErrors?.confirmarContrasena)}
          aria-describedby={
            state.fieldErrors?.confirmarContrasena ? "error-confirmar" : undefined
          }
        />
        {state.fieldErrors?.confirmarContrasena && (
          <p id="error-confirmar" className="text-sm text-destructive">
            {state.fieldErrors.confirmarContrasena[0]}
          </p>
        )}
      </div>

      <SubmitButton className="mt-2 w-full" pendingText={t("updatePasswordPending")}>
        {t("updatePassword")}
      </SubmitButton>
    </form>
  );
}
