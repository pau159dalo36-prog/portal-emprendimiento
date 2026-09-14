import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";
import { classifyRecoveryError } from "@/lib/supabase/auth-recovery";
import {
  REMEMBER_ME_COOKIE,
  adjustCookieOptions,
  rememberMeCookieOptions,
} from "@/lib/supabase/session-cookie";
import type { Database } from "@/types/database.types";

/**
 * Consume el OTP de recuperación EN EL EDGE (middleware) cuando la petición es
 * `/auth/reset-password?token_hash=...&type=recovery`.
 *
 * Por qué aquí y no (solo) en el Route Handler: en Netlify/OpenNext, el redirect
 * 307 que emite la FUNCIÓN (route handler) reescribe el Location a otra URL del
 * mismo sitio (p. ej. el alias `main--<site>.netlify.app`) y le re-inyecta la
 * query original. Resultado: las cookies de sesión (host-específicas) NO viajan
 * al nuevo host y la página `/actualizar-contrasena` se abre sin sesión.
 *
 * Al consumir el token en el middleware, el redirect es RELATIVO al host de la
 * petición (mismo host, sin reescritura de funciones) y las cookies de sesión
 * viajan con la misma respuesta. El token se consume ÚNICAMENTE aquí cuando la
 * ruta lleva credenciales; el Route Handler queda como respaldo (sin
 * credenciales → fallo técnico; `code`/PKCE → fallback).
 */
async function consumeRecoveryToken(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== "/auth/reset-password") {
    return null;
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (!tokenHash || type !== "recovery") {
    return null;
  }

  const response = NextResponse.redirect(new URL("/actualizar-contrasena", request.url));
  const rememberMe = request.cookies.get(REMEMBER_ME_COOKIE)?.value === "1";

  const supabase = createServerClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, adjustCookieOptions(options, rememberMe)),
        );
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });

  if (error) {
    const category = classifyRecoveryError(error);
    console.error(
      "[auth:recovery]",
      JSON.stringify({ flow: "middleware-otp", category, name: error?.name, code: error?.code }),
    );
    const target = new URL(`/actualizar-contrasena?error=${category}`, request.url);
    response.headers.set("Location", target.toString());
  }

  return response;
}

export async function updateSession(
  request: NextRequest,
  baseResponse?: NextResponse,
): Promise<NextResponse> {
  const recoveryResponse = await consumeRecoveryToken(request);
  if (recoveryResponse) {
    return recoveryResponse;
  }

  let supabaseResponse = baseResponse ?? NextResponse.next({ request });

  const rememberMe = request.cookies.get(REMEMBER_ME_COOKIE)?.value === "1";

  const supabase = createServerClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, adjustCookieOptions(options, rememberMe)),
        );
      },
    },
  });

  await supabase.auth.getClaims();

  request.cookies.getAll().forEach(({ name, value }) => supabaseResponse.cookies.set(name, value));

  if (rememberMe) {
    supabaseResponse.cookies.set(REMEMBER_ME_COOKIE, "1", rememberMeCookieOptions());
  }

  return supabaseResponse;
}
