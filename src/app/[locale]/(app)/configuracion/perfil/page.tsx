import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";

import { requireUser } from "@/auth/session";
import { buttonVariants } from "@/components/ui/button";
import { ProfileForm } from "@/components/profile/profile-form";
import {
  getAllSkills,
  getProfileInterests,
  getProfileSkills,
} from "@/profiles/data";
import { toProfileFormData, toSkillSelection } from "@/profiles/map";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("profileSettings") };
}

export default async function ProfileSettingsPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("settings");
  const common = await getTranslations("common");

  const [{ data: profile }, skills, initialSkills, initialInterests] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    getAllSkills(supabase),
    getProfileSkills(supabase, user.id),
    getProfileInterests(supabase, user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("profileTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("profileDescription")}</p>
        </div>
        {profile?.username && (
          <Link
            href={`/perfil/${profile.username}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink aria-hidden="true" />
            {common("viewPublicProfile")}
          </Link>
        )}
      </div>

      <ProfileForm
        initialProfile={toProfileFormData(profile)}
        skills={skills}
        initialSkills={toSkillSelection(initialSkills)}
        initialInterests={initialInterests.map((interest) => interest.name)}
      />
    </div>
  );
}
