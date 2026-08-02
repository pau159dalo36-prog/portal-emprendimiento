import type { CookieOptions } from "@supabase/ssr";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const REMEMBER_ME_COOKIE = "portal-remember-me";
export const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30;

function secureOptions(): Pick<CookieOptions, "secure"> {
  return IS_PRODUCTION ? { secure: true } : {};
}

export function rememberMeCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: REMEMBER_ME_MAX_AGE,
    ...secureOptions(),
  };
}

export function adjustCookieOptions(options: CookieOptions, persistent: boolean): CookieOptions {
  const next: CookieOptions = { ...options, ...secureOptions() };
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
