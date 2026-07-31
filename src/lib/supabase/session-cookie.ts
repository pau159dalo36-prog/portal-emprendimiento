import type { CookieOptions } from "@supabase/ssr";

export const REMEMBER_ME_COOKIE = "portal-remember-me";
export const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30;

export function rememberMeCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: REMEMBER_ME_MAX_AGE,
  };
}

export function adjustCookieOptions(options: CookieOptions, persistent: boolean): CookieOptions {
  const next: CookieOptions = { ...options };
  if (next.maxAge === 0) {
    return next;
  }
  if (persistent) {
    next.maxAge = REMEMBER_ME_MAX_AGE;
  } else {
    delete next.maxAge;
  }
  return next;
}
