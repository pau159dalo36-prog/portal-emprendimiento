import { getLocale } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { pageMetadataTitle } from "@/i18n/metadata";
import { getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("myProfile") };
}

export default async function MyProfilePage() {
  const { supabase } = await requireUser();
  const locale = await getLocale();

  const { data: profile } = await supabase.rpc("get_own_profile");

  if (profile?.username) {
    redirect(getPathname({ href: `/perfil/${profile.username}`, locale }));
  }

  redirect(getPathname({ href: "/configuracion/perfil", locale }));
}
