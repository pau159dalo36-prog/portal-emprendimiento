import { redirect } from "next/navigation";

import { requireUser } from "@/auth/session";
import { OnboardingForm } from "@/components/profile/onboarding-form";
import {
  getAllSkills,
  getProfileInterests,
  getProfileSkills,
} from "@/profiles/data";
import { toProfileFormData, toSkillSelection } from "@/profiles/map";

export const metadata = {
  title: "Completa tu perfil — Portal de Emprendimiento",
};

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, skills, initialSkills, initialInterests] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    getAllSkills(supabase),
    getProfileSkills(supabase, user.id),
    getProfileInterests(supabase, user.id),
  ]);

  if (profile?.onboarding_completed) {
    redirect("/panel");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <OnboardingForm
        initialProfile={toProfileFormData(profile)}
        skills={skills}
        initialSkills={toSkillSelection(initialSkills)}
        initialInterests={initialInterests.map((interest) => interest.name)}
      />
    </div>
  );
}
