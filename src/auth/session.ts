import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";

export async function getCurrentUser(): Promise<{
  supabase: SupabaseClient<Database>;
  user: { id: string } | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return { supabase, user: null };
  }

  return { supabase, user: { id: data.claims.sub } };
}

export async function requireUser() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    const locale = await getLocale();
    redirect(getPathname({ href: "/iniciar-sesion", locale }));
  }

  return { supabase, user };
}
