import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Globe, Mail, MapPin, Pencil, Users } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FollowButton } from "@/components/follows/follow-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjectCard } from "@/components/projects/project-card";
import { VideoCard } from "@/components/video/video-card";
import { brand } from "@/config/brand";
import { getOrganizationFollowCount, isFollowingOrganization } from "@/follows/data";
import {
  getOrganizationBySlug,
  getOrganizationLinks,
  getOrganizationMembers,
  isOrganizationManager,
} from "@/organizations/data";
import { listProjectsByOrganization } from "@/projects/data";
import { listPublishedVideosForOrganization } from "@/videos/data";
import { resolveVideoThumbnails } from "@/lib/video/preview";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";

type OrganizationProfilePageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata({
  params,
}: OrganizationProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const { supabase } = await getCurrentUser();
  const organization = await getOrganizationBySlug(supabase, slug);

  if (!organization) {
    return { title: await pageMetadataTitle("organizations") };
  }

  return {
    title: `${organization.name} — ${brand.name}`,
    description: organization.headline ?? undefined,
  };
}

export default async function OrganizationProfilePage({
  params,
}: OrganizationProfilePageProps) {
  const { slug, locale } = await params;
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("organizations");
  const industries = await getTranslations("industries");
  const common = await getTranslations("common");
  const followT = await getTranslations("publicProfile");

  const organization = await getOrganizationBySlug(supabase, slug);
  if (!organization) {
    notFound();
  }

  const [members, links, projects, videos, canEdit, followCount] = await Promise.all([
    getOrganizationMembers(supabase, organization.id),
    getOrganizationLinks(supabase, organization.id),
    listProjectsByOrganization(supabase, organization.id),
    listPublishedVideosForOrganization(supabase, organization.id, { limit: 12 }),
    user ? isOrganizationManager(supabase, organization.id, user.id) : Promise.resolve(false),
    getOrganizationFollowCount(supabase, organization.id),
  ]);
  const canFollow = !!user && !canEdit;
  const isFollowing = canFollow
    ? await isFollowingOrganization(supabase, user.id, organization.id)
    : false;
  const videoThumbnails = await resolveVideoThumbnails(supabase, videos);

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  });
  const createdDate = dateFormatter.format(new Date(organization.created_at));

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar name={organization.name} src={organization.logo_url} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {organization.name}
              </h1>
              {!organization.is_public && (
                <Badge className="border-border bg-muted text-muted-foreground">
                  {t("private")}
                </Badge>
              )}
            </div>
            {organization.headline && (
              <p className="mt-0.5 text-sm">{organization.headline}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {organization.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {organization.location}
                </span>
              )}
              {organization.owner && (
                <span>
                  {t("createdBy", { name: organization.owner.full_name ?? "" })}
                </span>
              )}
              <span>{createdDate}</span>
            </div>
          </div>
          {canEdit && (
            <Link
              href={`/organizaciones/${organization.slug}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil aria-hidden="true" />
              {t("edit")}
            </Link>
          )}
          {canFollow && (
            <FollowButton
              targetId={organization.id}
              targetType="organization"
              isFollowing={isFollowing}
            />
          )}
          <span className="text-sm text-muted-foreground">
            {followT("followers", { count: followCount })}
          </span>
        </CardHeader>
        <CardContent className="grid gap-4">
          {organization.industries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {organization.industries.map((industry) => (
                <Badge key={industry} className="border-primary/30 bg-primary/10 text-primary">
                  {industries(industry as Parameters<typeof industries>[0])}
                </Badge>
              ))}
            </div>
          )}
          {(organization.website_url || organization.contact_email) && (
            <div className="flex flex-wrap gap-2">
              {organization.website_url && (
                <Link
                  href={organization.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Globe className="size-4" aria-hidden="true" />
                  {common("website")}
                </Link>
              )}
              {organization.contact_email && (
                <Link
                  href={`mailto:${organization.contact_email}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  {organization.contact_email}
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("about")}</CardTitle>
        </CardHeader>
        <CardContent>
          {organization.description ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {organization.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("members")}</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {members.map((member) => {
                const profileHref = member.profile?.username
                  ? `/perfil/${member.profile.username}`
                  : null;
                const name = member.profile?.full_name ?? "—";
                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
                  >
                    <Avatar
                      name={member.profile?.full_name}
                      src={member.profile?.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0">
                      {profileHref ? (
                        <Link
                          href={profileHref}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="block truncate text-sm font-medium">{name}</span>
                      )}
                      {member.profile?.username && (
                        <p className="truncate text-xs text-muted-foreground">
                          @{member.profile.username}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
          )}
        </CardContent>
      </Card>

      {links.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("links")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {links.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("projects")}</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
          )}
        </CardContent>
      </Card>

      {videos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("videosTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  thumbnailSrc={videoThumbnails.get(video.id) ?? null}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {members.length > 0 && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden="true" />
          {t("memberCount", { count: members.length })}
        </div>
      )}
    </div>
  );
}
