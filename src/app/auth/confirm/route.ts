import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Ruta de confirmación OTP (legacy). Consume tokens de tipo `email`, `signup`,
 * `magiclink` y `email_change`. NO consume tokens de recuperación de
 * contraseña: cualquier `type=recovery` se reenvía a la ruta canónica
 * `/auth/reset-password` para garantizar UN único consumidor del recovery.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Reenvío de recovery al consumidor canónico (no consumir aquí).
  if (type === "recovery") {
    const target = new URL("/auth/reset-password", request.url);
    if (token_hash) target.searchParams.set("token_hash", token_hash);
    target.searchParams.set("type", "recovery");
    return NextResponse.redirect(target);
  }

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      if (type === "email_change") {
        return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
      }
      if (type === "signup" || type === "magiclink") {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
      return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
    }

    console.error("[auth:confirm]", JSON.stringify({ type, error: error?.code ?? error?.message }));
    return NextResponse.redirect(new URL("/iniciar-sesion?error=1", request.url));
  }

  return NextResponse.redirect(new URL("/iniciar-sesion?error=1", request.url));
}
