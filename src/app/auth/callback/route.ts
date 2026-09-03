import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginDestination } from "@/profiles/destination";

/**
 * Handles email confirmation and magic-link callbacks from Supabase.
 *
 * Supports both PKCE (`code`) and OTP (`token_hash` + `type`) flows so the
 * callback works regardless of the project's email auth configuration.
 *
 * Locale resolution is delegated to the intl middleware on the target path.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  // --- PKCE flow ---
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const destination = await getPostLoginDestination(supabase);
      return NextResponse.redirect(new URL(destination, request.url));
    }

    console.error("[auth:callback]", JSON.stringify({ flow: "pkce", error: error?.message }));
    return NextResponse.redirect(new URL("/iniciar-sesion?error=1", request.url));
  }

  // --- OTP flow ---
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      if (type === "signup" || type === "magiclink") {
        const destination = await getPostLoginDestination(supabase);
        return NextResponse.redirect(new URL(destination, request.url));
      }
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/actualizar-contrasena", request.url));
      }
      if (type === "email_change") {
        return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
      }
      return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
    }

    console.error("[auth:callback]", JSON.stringify({ flow: "otp", type, error: error?.message }));
    return NextResponse.redirect(new URL("/iniciar-sesion?error=1", request.url));
  }

  return NextResponse.redirect(new URL("/iniciar-sesion?error=1", request.url));
}
