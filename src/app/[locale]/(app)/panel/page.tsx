import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, ExternalLink, Settings2, Video } from "lucide-react";

import { requireUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCompletionPercent, getCompletionSections } from "@/profiles/completion";
import { getProfileInterests, getProfileSkills } from "@/profiles/data";
import { cn } from "@/lib/utils";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link, getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("panel") };
}

type ModuleItem = { title: string; description: string };

export default async function PanelPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("panel");
  const types = await getTranslations("types");
  const collab = await getTranslations("collab");
  const common = await getTranslations("common");
  const locale = await getLocale();

  const { profile, skills, interests } = await (async () => {
    const [{ data: profile }, skillRows, interestRows] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      getProfileSkills(supabase, user.id),
      getProfileInterests(supabase, user.id),
    ]);
    return { profile, skills: skillRows, interests: interestRows };
  })();

  if (!profile?.onboarding_completed) {
    redirect(getPathname({ href: "/onboarding", locale }));
  }

  const sections = getCompletionSections(profile, skills.length, interests.length);
  const percent = getCompletionPercent(sections);
  const modules = t.raw("modules") as Record<string, ModuleItem>;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar name={profile.full_name} src={profile.avatar_url} size="lg" />
          <div className="grid gap-1">
            <CardTitle>
              {t("greeting", { name: profile.full_name ?? t("defaultGreeting") })}
            </CardTitle>
            <CardDescription>
              {profile.headline ?? t("defaultHeadline")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("completeness")}</span>
            <span className="font-medium">{percent}%</span>
          </div>
          <Progress value={percent} />

          {percent < 100 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {sections
                .filter((section) => !section.done)
                .map((section) => (
                  <Badge
                    key={section.key}
                    className="border-border bg-muted text-muted-foreground"
                  >
                    {t("missing", {
                      label: t(
                        `sections.${section.key}` as Parameters<typeof t>[0],
                      ),
                    })}
                  </Badge>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/configuracion/perfil" className={buttonVariants()}>
          <Settings2 aria-hidden="true" />
          {common("editProfile")}
        </Link>
        {profile.username && (
          <Link
            href={`/perfil/${profile.username}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink aria-hidden="true" />
            {common("viewPublicProfile")}
          </Link>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2">
              <Video className="size-5 text-primary" aria-hidden="true" />
              {t("videosTitle")}
            </CardTitle>
            <CardDescription>{t("videosDescription")}</CardDescription>
          </div>
          <Link href="/panel/videos" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("manageVideos")}
          </Link>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("mainData")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              {profile.user_types.length > 0 ? (
                profile.user_types.map((type) => (
                  <Badge key={type} className="border-primary/30 bg-primary/10 text-primary">
                    {types(type as Parameters<typeof types>[0])}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">{t("noTypes")}</span>
              )}
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">{t("location")}</span>
              <span>{profile.location ?? "—"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">{t("weeklyAvailability")}</span>
              <span>{profile.weekly_availability != null ? `${profile.weekly_availability} h` : "—"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">{t("collaboration")}</span>
              <span>
                {profile.collaboration_preferences.length > 0
                  ? profile.collaboration_preferences
                      .map((pref) => collab(pref as Parameters<typeof collab>[0]))
                      .join(", ")
                  : "—"}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">{t("skills")}</span>
              <span>{skills.length > 0 ? skills.map((s) => s.name).join(", ") : "—"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">{t("interests")}</span>
              <span>
                {interests.length > 0 ? interests.map((i) => i.name).join(", ") : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("upcoming")}</CardTitle>
            <CardDescription>{t("upcomingDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {Object.values(modules).map((module) => (
              <div
                key={module.title}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3"
              >
                <div className="grid gap-0.5">
                  <span className="text-sm font-medium">{module.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {module.description}
                  </span>
                </div>
                <Badge className="border-border bg-muted text-muted-foreground">
                  {t("upcomingBadge")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end">
        <Link
          href={`/perfil/${profile.username ?? ""}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground",
            !profile.username && "pointer-events-none opacity-50",
          )}
        >
          <ArrowUpRight aria-hidden="true" />
          {t("howOthersSeeMe")}
        </Link>
      </div>
    </div>
  );
}
