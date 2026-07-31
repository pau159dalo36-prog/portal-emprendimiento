"use client";

import { useActionState } from "react";

import { updatePasswordAction } from "@/actions/auth";
import { initialAuthFormState } from "@/actions/auth-state";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialAuthFormState);

  return (
    <form action={formAction} noValidate className="grid gap-4">
      {state.message && (
        <FormMessage status={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="contrasena">Nueva contraseña</Label>
        <Input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          required
          aria-invalid={Boolean(state.fieldErrors?.contrasena)}
          aria-describedby={
            state.fieldErrors?.contrasena ? "error-contrasena" : "ayuda-contrasena"
          }
        />
        <p id="ayuda-contrasena" className="text-sm text-muted-foreground">
          Mínimo 8 caracteres, con mayúsculas, minúsculas y números.
        </p>
        {state.fieldErrors?.contrasena && (
          <p id="error-contrasena" className="text-sm text-destructive">
            {state.fieldErrors.contrasena[0]}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="confirmar-contrasena">Confirmar nueva contraseña</Label>
        <Input
          id="confirmar-contrasena"
          name="confirmar-contrasena"
          type="password"
          autoComplete="new-password"
          placeholder="Repite tu contraseña"
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

      <SubmitButton className="mt-2 w-full" pendingText="Actualizando contraseña…">
        Actualizar contraseña
      </SubmitButton>
    </form>
  );
}
