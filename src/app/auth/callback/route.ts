import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginDestination } from "@/profiles/destination";

/**
 * Ruta de callback PKCE/OTP para inicio de sesión y confirmación de cuenta.
 *
 * Maneja:
 *   - PKCE `code` (intercambio de código) para login/registro.
 *   - OTP `token_hash` para `signup`/`magiclink`/`email_change`.
 *
 * NO consume tokens de recuperación de contraseña: cualquier `type=recovery`
 * se reenvía a la ruta canónica `/auth/reset-password` para garantizar UN
 * único consumidor del recovery y evitar el doble procesamiento del token.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Reenvío de recovery al consumidor canónico (no consumir aquí).
  if (type === "recovery") {
    const target = new URL("/auth/reset-password", request.url);
    if (tokenHash) target.searchParams.set("token_hash", tokenHash);
    target.searchParams.set("type", "recovery");
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();

  // --- PKCE flow (login/registro) ---
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const destination = await getPostLoginDestination(supabase);
      return NextResponse.redirect(new URL(destination, request.url));
    }

    console.error("[auth:callback]", JSON.stringify({ flow: "pkce", error: error?.code ?? error?.message }));
    return NextResponse.redirect(new URL("/iniciar-sesion?error=1", request.url));
  }

  // --- OTP flow (signup / magiclink / email_change) ---
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      if (type === "signup" || type === "magiclink") {
        const destination = await getPostLoginDestination(supabase);
        return NextResponse.redirect(new URL(destination, request.url));
      }
      if (type === "email_change") {
        return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
      }
      return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
    }

    console.error("[auth:callback]", JSON.stringify({ flow: "otp", type, error: error?.code ?? error?.message }));
    return NextResponse.redirect(new URL("/iniciar-sesion?error=1", request.url));
  }

  return NextResponse.redirect(new URL("/iniciar-sesion?error=1", request.url));
}
