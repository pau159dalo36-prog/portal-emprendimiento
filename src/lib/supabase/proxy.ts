import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";
import {
  REMEMBER_ME_COOKIE,
  adjustCookieOptions,
  rememberMeCookieOptions,
} from "@/lib/supabase/session-cookie";
import type { Database } from "@/types/database.types";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

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
