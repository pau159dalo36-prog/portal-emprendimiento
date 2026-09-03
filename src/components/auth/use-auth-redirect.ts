"use client";

import { useEffect } from "react";

import type { AuthFormState } from "@/actions/auth-state";

/**
 * Cuando una mutación de autenticación termina en éxito con un destino
 * (`redirectTo`), fuerza una navegación completa a ese destino.
 *
 * Por qué no `redirect()` de Server Action + `revalidatePath`:
 * el estado autenticado lo decide el SERVIDOR (getCurrentUser), pero el
 * navegador mantiene en su Router Cache el RSC anónimo previo. En este host
 * (next Server Action + OpenNext/Netlify) esa invalidación server-side no
 * descarta de forma fiable el Router Cache del cliente, por lo que al volver a
 * la home se seguían mostrando los botones de visitante tras el login. Una
 * navegación completa recarga y descarta el Router Cache; la siguiente petición
 * al servidor devuelve la UI autenticada correcta (cookie ya escrita).
 */
export function useAuthRedirect(state: AuthFormState): void {
  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state]);
}
