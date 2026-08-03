import { getLocale } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { OnboardingForm } from "@/components/profile/onboarding-form";
import {
  getAllSkills,
  getProfileInterests,
  getProfileSkills,
} from "@/profiles/data";
import { toProfileFormData, toSkillSelection } from "@/profiles/map";
import { pageMetadataTitle } from "@/i18n/metadata";
import { getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("onboarding") };
}

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const locale = await getLocale();

  const [{ data: profile }, skills, initialSkills, initialInterests] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    getAllSkills(supabase),
    getProfileSkills(supabase, user.id),
    getProfileInterests(supabase, user.id),
  ]);

  if (profile?.onboarding_completed) {
    redirect(getPathname({ href: "/panel", locale }));
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
