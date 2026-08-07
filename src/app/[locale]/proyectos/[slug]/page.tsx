import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Globe, Pencil } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { VideoCard } from "@/components/video/video-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { brand } from "@/config/brand";
import {
  getProjectBySlug,
  getProjectLinks,
  getProjectMembers,
  getProjectNeeds,
} from "@/projects/data";
import { listPublishedVideosForProject } from "@/videos/data";
import { resolveVideoThumbnails } from "@/lib/video/preview";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";

type ProjectDetailPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata({
  params,
}: ProjectDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { supabase } = await getCurrentUser();
  const project = await getProjectBySlug(supabase, slug);

  if (!project) {
    return { title: await pageMetadataTitle("projects") };
  }

  return {
    title: `${project.name} — ${brand.name}`,
    description: project.tagline ?? undefined,
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { slug, locale } = await params;
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("projects");
  const industries = await getTranslations("industries");
  const stages = await getTranslations("projectStages");
  const statuses = await getTranslations("projectStatuses");
  const needStatuses = await getTranslations("needStatuses");

  const project = await getProjectBySlug(supabase, slug);
  if (!project) {
    notFound();
  }

  const [members, needs, links, projectVideos] = await Promise.all([
    getProjectMembers(supabase, project.id),
    getProjectNeeds(supabase, project.id),
    getProjectLinks(supabase, project.id),
    listPublishedVideosForProject(supabase, project.id, { limit: 12 }),
  ]);

  const isOwner = user?.id === project.owner_id;
  const thumbnails = await resolveVideoThumbnails(supabase, projectVideos);
  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grid gap-6">
      {project.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.cover_image_url}
          alt=""
          className="h-56 w-full rounded-2xl border border-border object-cover"
        />
      )}

      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge className="border-primary/30 bg-primary/10 text-primary">
                {stages(project.stage as Parameters<typeof stages>[0])}
              </Badge>
              {project.status !== "published" && (
                <Badge className="border-border bg-muted text-muted-foreground">
                  {statuses(project.status as Parameters<typeof statuses>[0])}
                </Badge>
              )}
            </div>
            {project.tagline && (
              <p className="mt-0.5 text-sm">{project.tagline}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {project.organization ? (
                <Link
                  href={`/organizaciones/${project.organization.slug}`}
                  className="hover:underline"
                >
                  {t("byOrganization", { name: project.organization.name })}
                </Link>
              ) : (
                <span>{t("noOrganization")}</span>
              )}
              {project.owner?.full_name && (
                <span>{t("createdBy", { name: project.owner.full_name })}</span>
              )}
              <span>
                {t("publishedOn", {
                  date: dateFormatter.format(new Date(project.created_at)),
                })}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {project.website_url && (
              <Link
                href={project.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <Globe className="size-4" aria-hidden="true" />
                {project.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </Link>
            )}
            {isOwner && (
              <Link
                href={`/proyectos/${project.slug}/editar`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil aria-hidden="true" />
                {t("edit")}
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {project.industries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {project.industries.map((industry) => (
                <Badge key={industry} className="border-primary/30 bg-primary/10 text-primary">
                  {industries(industry as Parameters<typeof industries>[0])}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("about")}</CardTitle>
        </CardHeader>
        <CardContent>
          {project.description ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
          )}
        </CardContent>
      </Card>

      {project.problem && (
        <Card>
          <CardHeader>
            <CardTitle>{t("problem")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {project.problem}
            </p>
          </CardContent>
        </Card>
      )}

      {project.solution && (
        <Card>
          <CardHeader>
            <CardTitle>{t("solution")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {project.solution}
            </p>
          </CardContent>
        </Card>
      )}

      {project.target_market && (
        <Card>
          <CardHeader>
            <CardTitle>{t("targetMarket")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {project.target_market}
            </p>
          </CardContent>
        </Card>
      )}

      {project.traction && (
        <Card>
          <CardHeader>
            <CardTitle>{t("traction")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {project.traction}
            </p>
          </CardContent>
        </Card>
      )}

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

      {needs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("needs")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {needs.map((need) => (
                <li key={need.id} className="grid gap-1 rounded-lg border border-border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{need.title}</p>
                    <Badge
                      className={
                        need.status === "open"
                          ? "border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {needStatuses(need.status as Parameters<typeof needStatuses>[0])}
                    </Badge>
                  </div>
                  {need.commitment && (
                    <p className="text-xs text-muted-foreground">{need.commitment}</p>
                  )}
                  {need.description && (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {need.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {projectVideos.length > 0 && (
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
              {projectVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  thumbnailSrc={thumbnails.get(video.id) ?? null}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
