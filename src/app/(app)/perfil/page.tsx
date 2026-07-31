import { redirect } from "next/navigation";

import { requireUser } from "@/auth/session";

export const metadata = {
  title: "Mi perfil — Portal de Emprendimiento",
};

export default async function MyProfilePage() {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.username) {
    redirect(`/perfil/${profile.username}`);
  }

  redirect("/configuracion/perfil");
}
