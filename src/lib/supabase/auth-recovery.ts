import type { AuthError } from "@supabase/supabase-js";

/**
 * Categoría de fallo de un enlace de recuperación. Solo `expired` debe
 * mostrarse como "enlace expirado o no válido". Cualquier otra cosa
 * (`technical`) indica un problema de entorno/routing/PKCE y NO debe
 * confundirse con un enlace caducado real.
 */
export type RecoveryErrorCategory = "expired" | "technical";

/**
 * Clasifica el error devuelto por Supabase al procesar un enlace de
 * recuperación (verifyOtp / exchangeCodeForSession).
 *
 * - `expired`: el token es real pero ha caducado, ya se usó o no corresponde a
 *   un usuario válido (codes `otp_expired`, sesión/usuario ausente). Es el
 *   único caso en que la UI debe mostrar "enlace expirado".
 * - `technical`: el error obedece a la infraestructura (p. ej. el verifier PKCE
 *   no está en storage porque el enlace se abrió en otro navegador/dispositivo,
 *   o un fallo de red/retryable). Nunca debe pintarse como "enlace expirado".
 *
 * Los datos sensibles (tokens, contraseñas, secretos) nunca entran aquí; solo
 * se usan `name`/`code`/`message` para clasificar.
 */
export function classifyRecoveryError(error: AuthError | null): RecoveryErrorCategory {
  if (!error) {
    return "technical";
  }

  const name = error.name ?? "";
  const code = error.code ?? "";

  // Casos genuinos de token caducado, usado o inválido.
  if (code === "otp_expired") {
    return "expired";
  }
  // Sesión/usuario ausente tras un intercambio o verificación satisfactoria a
  // nivel HTTP: el token se consumió pero no abrió sesión (ya usado / expirado).
  if (name === "AuthInvalidTokenResponseError") {
    return "expired";
  }
  // La OTP está deshabilitada para este tipo de correo.
  if (code === "otp_disabled") {
    return "expired";
  }
  // Mensaje explícito de token caducado/procesado.
  const message = (error.message ?? "").toLowerCase();
  if (
    message.includes("expired") ||
    message.includes("token has expired") ||
    message.includes("already been used") ||
    message.includes("code has expired") ||
    // La OTP no coincide con ninguna pendiente: token consumido/inválido real
    // (GoTrue: "Email OTP verification failed"). Es un enlace que ya no sirve,
    // no un problema de infraestructura.
    message.includes("verification failed")
  ) {
    return "expired";
  }

  // PKCE: verifier ausente (enlace abierto en otro navegador/dispositivo) o
  // fallo del intercambio de código. Problema de entorno, NO enlace expired.
  if (
    name === "AuthPKCECodeVerifierMissingError" ||
    name === "AuthPKCEGrantCodeExchangeError" ||
    name === "AuthRetryableFetchError"
  ) {
    return "technical";
  }

  // Cualquier otro fallo (5xx, rate-limit, red, código inesperado): tratarlo
  // como error técnico y NUNCA como "enlace expirado".
  return "technical";
}
