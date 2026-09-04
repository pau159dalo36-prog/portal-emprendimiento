"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import type { AuthFormAction, AuthFormState } from "@/actions/auth-state";

/**
 * Gestiona el envío de un formulario de autenticación de forma robusta:
 *
 * 1. Llama a la Server Action directamente desde el handler de submit
 *    (await) y aplica el estado resultante a un `useState` local.
 * 2. Usa `try/finally` para que `pending` SIEMPRE se restablezca después de
 *    la petición, con independencia de si la action termina en éxito, error
 *    o lanza una excepción. Así el botón nunca se queda en "loading" infinito.
 * 3. Cuando la action devuelve `status: "success"` con `redirectTo`, la
 *    navegación completa se ejecuta INMEDIATAMENTE en el handler (no en un
 *    useEffect): en ese punto la Server Action ya escribió la cookie de sesión
 *    en la respuesta, por lo que la siguiente petición de la página de destino
 *    llevará la cookie y el servidor renderizará la UI autenticada.
 *
 * Por qué este patrón y no `useActionState` + `useEffect` (window.location.assign
 * reaccionando al state): la navegación disparada desde un efecto se ejecuta
 * dentro del ciclo de commit/transición de React y es la parte frágil que podía
 * dejar el flujo colgado. Aquí la navegación se hace sincrónicamente justo
 * después del resultado de la action, fuera del ciclo de render.
 */
export function useAuthForm(
  action: AuthFormAction,
  initialState: AuthFormState,
  errorMessage?: string,
) {
  const [state, setState] = useState<AuthFormState>(initialState);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await action(initialState, formData);
      setState(result);
      if (result.status === "success" && result.redirectTo) {
        window.location.assign(result.redirectTo);
        return;
      }
    } catch {
      // Si la Server Action lanza una excepción (en vez de devolver un estado de
      // error), la derivamos a un estado de error amigable para que el botón
      // salga de "loading" y el usuario vea algo — nunca un "loading" infinito
      // ni una promesa sin manejar.
      setState({ status: "error", message: errorMessage ?? "error" });
    } finally {
      setPending(false);
    }
  }

  return { state, pending, handleSubmit };
}
