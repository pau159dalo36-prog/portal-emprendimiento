import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/actualizar-contrasena", request.url));
      }
      if (type === "email_change") {
        return NextResponse.redirect(new URL("/configuracion/perfil", request.url));
      }
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return NextResponse.redirect(new URL("/iniciar-sesion?error=1", request.url));
}
