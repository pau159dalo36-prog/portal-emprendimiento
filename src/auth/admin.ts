import { getLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/session";
import { getPathname } from "@/i18n/navigation";

export async function requireAdmin() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    const locale = await getLocale();
    redirect(getPathname({ href: "/iniciar-sesion", locale }));
  }

  const { data } = await supabase.auth.getClaims();
  const isAdmin = data?.claims?.app_metadata?.role === "admin";
  if (!isAdmin) {
    notFound();
  }

  return { supabase, user };
}
