import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";
import {
  REMEMBER_ME_COOKIE,
  adjustCookieOptions,
  rememberMeCookieOptions,
} from "@/lib/supabase/session-cookie";
import type { Database } from "@/types/database.types";

export async function createClient(options?: { persistent?: boolean }) {
  const cookieStore = await cookies();
  const persistent = options?.persistent ?? cookieStore.has(REMEMBER_ME_COOKIE);

  return createServerClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, adjustCookieOptions(options, persistent)),
          );
          if (persistent) {
            cookieStore.set(REMEMBER_ME_COOKIE, "1", rememberMeCookieOptions());
          } else {
            cookieStore.delete(REMEMBER_ME_COOKIE);
          }
        } catch {
          // Las cookies de sesión se escriben desde src/proxy.ts, no desde un Server Component.
        }
      },
    },
  });
}
