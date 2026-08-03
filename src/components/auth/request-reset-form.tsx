"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { requestPasswordResetAction } from "@/actions/auth";
import { initialAuthFormState } from "@/actions/auth-state";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function RequestResetForm() {
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    initialAuthFormState,
  );
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

      <SubmitButton className="mt-2 w-full" pendingText={t("sendResetLinkPending")}>
        {t("sendResetLink")}
      </SubmitButton>
    </form>
  );
}
