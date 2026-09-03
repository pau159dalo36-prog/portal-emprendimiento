import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
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
 * Errores: se distingue entre enlace REALMENTE caducado/usado (`expired`) y
 * fallos técnicos/PKCE (`technical`). Solo el primero muestra el mensaje de
 * "enlace expirado"; el segundo pide reintentar.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");

  const supabase = await createClient();

  // --- 1) OTP / token_hash (flujo robusto, sin PKCE) ---
  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });

    if (!error) {
      // verifyOtp ya ha guardado la sesión de recuperación en cookies.
      return NextResponse.redirect(new URL("/actualizar-contrasena", request.url));
    }

    const category = classifyRecoveryError(error);
    console.error("[auth:recovery]", JSON.stringify({ flow: "otp", category, name: error?.name }));
    return recoveryErrorRedirect(request, category);
  }

  // --- 2) PKCE / code (fallback) ---
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);

    if (!error) {
      return NextResponse.redirect(new URL("/actualizar-contrasena", request.url));
    }

    const category = classifyRecoveryError(error);
    console.error("[auth:recovery]", JSON.stringify({ flow: "pkce", category, name: error?.name }));
    return recoveryErrorRedirect(request, category);
  }

  // --- 3) Sin credenciales reconocibles → enlace mal formado/expirado ---
  console.error("[auth:recovery]", JSON.stringify({ flow: "none", category: "expired" }));
  return recoveryErrorRedirect(request, "expired");
}

function recoveryErrorRedirect(request: NextRequest, category: "expired" | "technical") {
  return NextResponse.redirect(
    new URL(
      category === "expired"
        ? "/recuperar-contrasena?error=expired"
        : "/recuperar-contrasena?error=technical&reintentar=1",
      request.url,
    ),
  );
}
