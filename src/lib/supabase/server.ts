import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";
import {
  REMEMBER_ME_COOKIE,
  adjustCookieOptions,
  rememberMeCookieOptions,
} from "@/lib/supabase/session-cookie";
import type { Database } from "@/types/database.types";

type CookieStore = {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: CookieOptions): void;
  delete(name: string): void;
};

function createServerClientWith(cookieStore: CookieStore, persistent: boolean) {
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

export async function createClient(options?: { persistent?: boolean }) {
  const cookieStore = await cookies();
  const persistent = options?.persistent ?? cookieStore.has(REMEMBER_ME_COOKIE);

  return createServerClientWith(
    {
      getAll: () => cookieStore.getAll(),
      set: (name, value, cookieOptions) => cookieStore.set(name, value, cookieOptions),
      delete: (name) => cookieStore.delete(name),
    },
    persistent,
  );
}

/**
 * Cliente Supabase para Route Handlers: enlaza las cookies de sesión AL mismo
 * `NextResponse` que la ruta devolverá (p. ej. un redirect). Así las
 * Set-Cookie que genera `verifyOtp`/`exchangeCodeForSession` se adjuntan a la
 * respuesta final y llegan al navegador, en lugar de perderse al escribir vía
 * `cookies()` de `next/headers` y devolver después un redirect.
 */
export function createRouteHandlerClient(
  response: NextResponse,
  options?: { persistent?: boolean },
) {
  return createServerClientWith(
    {
      getAll: () => response.cookies.getAll(),
      set: (name, value, cookieOptions) => response.cookies.set(name, value, cookieOptions),
      delete: (name) => response.cookies.delete(name),
    },
    options?.persistent ?? false,
  );
}
