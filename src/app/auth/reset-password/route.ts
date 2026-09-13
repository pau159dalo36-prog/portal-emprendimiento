import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { classifyRecoveryError } from "@/lib/supabase/auth-recovery";

/**
 * Ruta CANÓNICA (único consumidor) del enlace de recuperación de contraseña.
 *
 * El template de correo de Supabase debe apuntar aquí:
 *
 *   http://localhost:3000/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery
 *   https://sensational-squirrel-26a2f8.netlify.app/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery
 *
 * Soporta los formatos que Supabase pueda entregar:
 *   1. OTP (`token_hash` + `type=recovery`): vía `verifyOtp`. Es el flujo
 *      robusto y recomendado por Supabase para @supabase/ssr porque NO depende
 *      del verifier PKCE ni de estado previo: funciona desde cualquier
 *      navegador/dispositivo.
 *   2. PKCE (`code`): vía `exchangeCodeForSession`. Se conserva como fallback
 *      para enlaces basados en `{{ .ConfirmationURL }}` ya enviados.
 *
 * El token se consume UNA SOLA vez aquí. Después se establece la sesión de
 * recuperación en cookies y se redirige a /actualizar-contrasena (el middleware
 * de idioma resuelve el prefijo de locale, p. ej. /es/actualizar-contrasena).
 *
 * Cookies y redirect: el cliente Supabase se enlaza AL `NextResponse` que
 * devolvemos (createRouteHandlerClient). De ese modo las Set-Cookie de la
 * sesión viajan en la misma respuesta redirect y el navegador llega a
 * /actualizar-contrasena ya autenticado. Sin esto, la sesión puede perderse y
 * la página rebota creando un bucle.
 *
 * Errores: se distingue entre enlace REALMENTE caducado/usado (`expired`) y
 * fallos técnicos (`technical`). Ambos se muestran en /actualizar-contrasena
 * (tarjeta de error), NUNCA redirigiendo por debajo a /recuperar-contrasena.
 * Un enlace sin credenciales es un fallo técnico, no un token caducado.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");

  // Única respuesta del handler: las cookies de sesión que escriba Supabase se
  // adjuntan a ESTE objeto; al devolverlo como redirect (Location) viajan con él.
  const response = NextResponse.redirect(new URL("/", request.url));
  const supabase = createRouteHandlerClient(response);

  // --- 1) OTP / token_hash (flujo robusto, sin PKCE) ---
  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });

    if (!error) {
      return redirectTo(response, new URL("/actualizar-contrasena", request.url));
    }

    const category = classifyRecoveryError(error);
    console.error(
      "[auth:recovery]",
      JSON.stringify({ flow: "otp", category, name: error?.name, code: error?.code }),
    );
    return redirectTo(response, errorTarget(category, request));
  }

  // --- 2) PKCE / code (fallback) ---
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );

    if (!error) {
      return redirectTo(response, new URL("/actualizar-contrasena", request.url));
    }

    const category = classifyRecoveryError(error);
    console.error(
      "[auth:recovery]",
      JSON.stringify({ flow: "pkce", category, name: error?.name, code: error?.code }),
    );
    return redirectTo(response, errorTarget(category, request));
  }

  // --- 3) Sin credenciales reconocibles → enlace mal formado/incompleto. No es
  //     un token caducado: es un fallo técnico (routing/entorno) y se loguea.
  console.error("[auth:recovery]", JSON.stringify({ flow: "none", category: "technical" }));
  return redirectTo(response, errorTarget("technical", request));
}

function errorTarget(category: "expired" | "technical", request: NextRequest) {
  return new URL(`/actualizar-contrasena?error=${category}`, request.url);
}

function redirectTo(response: NextResponse, target: URL) {
  response.headers.set("Location", target.toString());
  return response;
}
