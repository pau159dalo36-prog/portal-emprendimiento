import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the recovery link that Supabase sends via email.
 *
 * Supports two flows depending on the Supabase project configuration:
 *   1. **PKCE** – the URL carries `?code=…`. We exchange it for a session.
 *   2. **OTP**  – the URL carries `?token_hash=…&type=recovery`. We verify
 *      the OTP and establish a session.
 *
 * On success the user is redirected to `/actualizar-contrasena` where they can
 * set a new password. On failure we redirect to `/recuperar-contrasena` with an
 * error indicator so the page can show an appropriate message.
 *
 * Locale resolution is delegated to the intl middleware that runs on the
 * redirected path.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  // --- PKCE flow (default in Supabase v2) ---
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      return NextResponse.redirect(new URL("/actualizar-contrasena", request.url));
    }

    console.error("[auth:reset-password]", JSON.stringify({ flow: "pkce", error: error?.message }));
    return NextResponse.redirect(new URL("/recuperar-contrasena?error=expired", request.url));
  }

  // --- OTP / token_hash flow ---
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/actualizar-contrasena", request.url));
      }
      // email_change or other OTP types → fallback to sign-in
      return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
    }

    console.error("[auth:reset-password]", JSON.stringify({ flow: "otp", type, error: error?.message }));
    return NextResponse.redirect(new URL("/recuperar-contrasena?error=expired", request.url));
  }

  // --- No recognisable params → bad/expired link ---
  return NextResponse.redirect(new URL("/recuperar-contrasena?error=expired", request.url));
}
