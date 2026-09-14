/**
 * Recoge los parámetros de enlace de recuperación que puedan quedar en la URL
 * al llegar a `/actualizar-contrasena`.
 *
 * Por qué existe: en Netlify/OpenNext, el redirect 307 que emite el Route
 * Handler `/auth/reset-password` tras consumir un OTP real puede re-inyectar
 * la query original de la petición en el `Location` (p. ej.
 * `/actualizar-contrasena?token_hash=...&type=recovery`). El token YA se
 * consumió en la ruta; esos parámetros son basura. Este módulo devuelve una URL
 * limpia (sin token_hash/type/code/sb_flow_id) para que el middleware haga un
 * redirect final limpio antes de llegar a la página. La página es y sigue
 * siendo pasiva: nunca verifica ni consume el token.
 */
const RECOVERY_PAGE_PATHS = new Set([
  "/actualizar-contrasena",
  "/es/actualizar-contrasena",
  "/en/actualizar-contrasena",
]);

const RECOVERY_LINK_PARAMS = ["token_hash", "type", "code", "sb_flow_id"] as const;

export function cleanRecoveryPageParams(url: string): string | null {
  const parsed = new URL(url);

  if (!RECOVERY_PAGE_PATHS.has(parsed.pathname)) {
    return null;
  }

  let changed = false;
  for (const key of RECOVERY_LINK_PARAMS) {
    if (parsed.searchParams.has(key)) {
      parsed.searchParams.delete(key);
      changed = true;
    }
  }

  return changed ? parsed.toString() : null;
}