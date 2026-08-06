import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CalendarDays, Clock, Globe, Link as LinkIcon, MapPin } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VideoCard } from "@/components/video/video-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProfileInterests, getProfileSkills } from "@/profiles/data";
import { brand } from "@/config/brand";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { listPublishedVideos } from "@/videos/data";

type PublicProfilePageProps = {
  params: Promise<{ username: string; locale: string }>;
};

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const { supabase } = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, headline")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  return {
    title: profile?.full_name
      ? `${profile.full_name} — ${brand.name}`
      : await pageMetadataTitle("profile"),
    description: profile?.headline ?? undefined,
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username, locale } = await params;
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("publicProfile");
  const types = await getTranslations("types");
  const collab = await getTranslations("collab");
  const skillLevels = await getTranslations("skillLevels");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const isOwner = user?.id === profile.id;

  const joinedDate = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(profile.created_at));

  const [skills, interests, publishedVideos] = await Promise.all([
    getProfileSkills(supabase, profile.id),
    getProfileInterests(supabase, profile.id),
    listPublishedVideos(supabase, { authorId: profile.id, limit: 12 }),
  ]);

  const firstName = profile.full_name?.split(" ")[0];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar name={profile.full_name} src={profile.avatar_url} size="xl" />
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {profile.full_name ?? t("noName")}
              </h1>
              {isOwner && (
                <Badge className="border-border bg-muted text-muted-foreground">
                  {t("isYou")}
                </Badge>
              )}
            </div>
            {profile.username && (
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            )}
            {profile.headline && <p className="text-sm">{profile.headline}</p>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {(profile.location ||
            profile.weekly_availability != null ||
            profile.created_at) && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {profile.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {profile.location}
                </span>
              )}
              {profile.weekly_availability != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" aria-hidden="true" />
                  {t("hoursPerWeek", { hours: profile.weekly_availability })}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                {t("joined", { date: joinedDate })}
              </span>
            </div>
          )}

          {profile.user_types.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.user_types.map((type) => (
                <Badge
                  key={type}
                  className="border-primary/30 bg-primary/10 text-primary"
                >
                  {types(type as Parameters<typeof types>[0])}
                </Badge>
              ))}
            </div>
          )}

          {(profile.website_url || profile.linkedin_url) && (
            <div className="flex flex-wrap gap-2">
              {profile.website_url && (
                <Link
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Globe className="size-4" aria-hidden="true" />
                  {t("web")}
                </Link>
              )}
              {profile.linkedin_url && (
                <Link
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <LinkIcon className="size-4" aria-hidden="true" />
                  {t("linkedIn")}
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("about", { firstName: firstName ?? t("aboutMe") })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.bio ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {profile.bio}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noBio")}</p>
          )}
        </CardContent>
      </Card>

      {publishedVideos.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle>{t("videosTitle")}</CardTitle>
            <Link
              href="/videos"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t("viewAllVideos")}
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {publishedVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("skillsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {skills.length > 0 ? (            <ul className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <li key={skill.skill_id}>
                  <Badge className="gap-1 border-border bg-muted px-3 py-1.5 text-sm">
                    {skill.name}
                    {skill.level != null && (
                      <span className="text-muted-foreground">
                        {" "}· {skillLevels(String(skill.level) as Parameters<typeof skillLevels>[0])}
                      </span>
                    )}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noSkills")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("interestsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {interests.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <li key={interest.name}>
                  <Badge className="gap-1 border-border bg-muted px-3 py-1.5 text-sm">
                    {interest.name}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noInterests")}</p>
          )}
        </CardContent>
      </Card>

      {profile.collaboration_preferences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("collaborationTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {profile.collaboration_preferences.map((preference) => (
                <li key={preference}>
                  <Badge className="gap-1 border-border bg-muted px-3 py-1.5 text-sm">
                    {collab(preference as Parameters<typeof collab>[0])}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
