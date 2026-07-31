"use client";

import { useActionState } from "react";

import { signUpAction } from "@/actions/auth";
import { initialAuthFormState } from "@/actions/auth-state";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Checkbox } from "@/components/ui/checkbox";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialAuthFormState);

  return (
    <form action={formAction} noValidate className="grid gap-4">
      {state.message && (
        <FormMessage status={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="nombre">Nombre y apellidos</Label>
        <Input
          id="nombre"
          name="nombre"
          autoComplete="name"
          placeholder="Ej. Ana García"
          required
          aria-invalid={Boolean(state.fieldErrors?.nombre)}
          aria-describedby={state.fieldErrors?.nombre ? "error-nombre" : undefined}
        />
        {state.fieldErrors?.nombre && (
          <p id="error-nombre" className="text-sm text-destructive">
            {state.fieldErrors.nombre[0]}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="correo">Correo electrónico</Label>
        <Input
          id="correo"
          name="correo"
          type="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
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
        <Label htmlFor="contrasena">Contraseña</Label>
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
        <Label htmlFor="confirmar-contrasena">Confirmar contraseña</Label>
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

      <div className="flex items-start gap-2">
        <Checkbox id="terminos" name="terminos" value="on" className="mt-0.5" />
        <Label htmlFor="terminos" className="leading-6 font-normal">
          He leído y acepto los términos y condiciones y la política de privacidad.
        </Label>
      </div>
      {state.fieldErrors?.terminos && (
        <p className="text-sm text-destructive">{state.fieldErrors.terminos[0]}</p>
      )}

      <SubmitButton className="mt-2 w-full" pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
