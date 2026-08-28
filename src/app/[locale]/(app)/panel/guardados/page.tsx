import { getLocale, getTranslations } from "next-intl/server";
import { Bookmark, Briefcase, FolderKanban, Play, Store } from "lucide-react";

import { requireUser } from "@/auth/session";
import { SaveButton } from "@/components/interactions/save-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import {
  listSavedOpportunities,
  listSavedPosts,
  listSavedProjects,
  listSavedServices,
} from "@/interactions/saves";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("panelSaved") };
}

export default async function PanelSavedItemsPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("savedPanel");
  const typesT = await getTranslations("opportunityTypes");
  const stages = await getTranslations("projectStages");
  const servicesT = await getTranslations("services");
  const locale = await getLocale();

  const [savedPosts, savedProjects, savedOpportunities, savedServices] = await Promise.all([
    listSavedPosts(supabase, user.id),
    listSavedProjects(supabase, user.id),
    listSavedOpportunities(supabase, user.id),
    listSavedServices(supabase, user.id),
  ]);

  // Los LEFT JOIN vacíos (elemento ya no visible) no se muestran.
  const posts = savedPosts.filter((row) => row.post !== null);
  const projects = savedProjects.filter((row) => row.project !== null);
  const opportunities = savedOpportunities.filter((row) => row.opportunity !== null);
  const services = savedServices.filter((row) => row.service !== null);

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isEmpty =
    posts.length === 0 &&
    projects.length === 0 &&
    opportunities.length === 0 &&
    services.length === 0;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Bookmark className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
            <Link href="/explorar" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("explore")}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8">
          {posts.length > 0 && (
            <section aria-labelledby="saved-posts-title" className="grid gap-3">
              <h2
                id="saved-posts-title"
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <Play className="size-4" aria-hidden="true" />
                {t("postsSection", { count: posts.length })}
              </h2>
              <div className="grid gap-3">
                {posts.map(({ post, ...row }) =>
                  post ? (
                    <Card key={`${row.profile_id}-${row.post_id}`}>
                      <CardContent className="flex flex-wrap items-center gap-4">
                        <div className="min-w-0 flex-1 grid gap-1">
                          <Link
                            href={`/videos/${post.video_id ?? ""}`}
                            className="truncate text-base font-semibold hover:underline"
                          >
                            {post.video_title ?? t("postFallbackTitle")}
                          </Link>
                          <p className="line-clamp-1 text-sm text-muted-foreground">
                            {post.body ?? t("postFallbackBody")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("savedOn", { date: dateFormatter.format(new Date(row.created_at)) })}
                          </p>
                        </div>
                        {post.video_id && (
                          <SaveButton targetId={post.id} targetType="post" saved />
                        )}
                      </CardContent>
                    </Card>
                  ) : null,
                )}
              </div>
            </section>
          )}

          {projects.length > 0 && (
            <section aria-labelledby="saved-projects-title" className="grid gap-3">
              <h2
                id="saved-projects-title"
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <FolderKanban className="size-4" aria-hidden="true" />
                {t("projectsSection", { count: projects.length })}
              </h2>
              <div className="grid gap-3">
                {projects.map(({ project, ...row }) =>
                  project ? (
                    <Card key={`${row.profile_id}-${row.project_id}`}>
                      <CardContent className="flex flex-wrap items-center gap-4">
                        <div className="min-w-0 flex-1 grid gap-1">
                          <Link
                            href={`/proyectos/${project.slug}`}
                            className="truncate text-base font-semibold hover:underline"
                          >
                            {project.name}
                          </Link>
                          <p className="line-clamp-1 text-sm text-muted-foreground">
                            {project.tagline ?? ""}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge className="border-primary/30 bg-primary/10 text-primary">
                              {stages(project.stage as Parameters<typeof stages>[0])}
                            </Badge>
                            {t("savedOn", {
                              date: dateFormatter.format(new Date(row.created_at)),
                            })}
                          </div>
                        </div>
                        <SaveButton targetId={project.id} targetType="project" saved />
                      </CardContent>
                    </Card>
                  ) : null,
                )}
              </div>
            </section>
          )}

          {opportunities.length > 0 && (
            <section aria-labelledby="saved-opportunities-title" className="grid gap-3">
              <h2
                id="saved-opportunities-title"
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <Briefcase className="size-4" aria-hidden="true" />
                {t("opportunitiesSection", { count: opportunities.length })}
              </h2>
              <div className="grid gap-3">
                {opportunities.map(({ opportunity, ...row }) =>
                  opportunity ? (
                    <Card key={`${row.profile_id}-${row.opportunity_id}`}>
                      <CardContent className="flex flex-wrap items-center gap-4">
                        <div className="min-w-0 flex-1 grid gap-1">
                          <Link
                            href={`/oportunidades/${opportunity.id}`}
                            className="truncate text-base font-semibold hover:underline"
                          >
                            {opportunity.title}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge className="border-border bg-muted text-muted-foreground">
                              {typesT(
                                opportunity.opportunity_type as Parameters<typeof typesT>[0],
                              )}
                            </Badge>
                            {[opportunity.city, opportunity.country]
                              .filter(Boolean)
                              .join(", ")}
                            {" · "}
                            {t("savedOn", {
                              date: dateFormatter.format(new Date(row.created_at)),
                            })}
                          </div>
                        </div>
                        <SaveButton
                          targetId={opportunity.id}
                          targetType="opportunity"
                          saved
                        />
                      </CardContent>
                    </Card>
                  ) : null,
                )}
              </div>
            </section>
          )}
          {services.length > 0 && (
            <section aria-labelledby="saved-services-title" className="grid gap-3">
              <h2
                id="saved-services-title"
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <Store className="size-4" aria-hidden="true" />
                {t("servicesSection", { count: services.length })}
              </h2>
              <div className="grid gap-3">
                {services.map(({ service, ...row }) =>
                  service ? (
                    <Card key={`${row.profile_id}-${row.service_id}`}>
                      <CardContent className="flex flex-wrap items-center gap-4">
                        <div className="min-w-0 flex-1 grid gap-1">
                          <Link
                            href={`/servicios/${service.id}`}
                            className="truncate text-base font-semibold hover:underline"
                          >
                            {service.title}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge className="border-primary/30 bg-primary/10 text-primary">
                              {servicesT(`categories.${service.category}` as never)}
                            </Badge>
                            {servicesT(`pricingTypes.${service.pricing_type}` as never)}
                            {service.provider_username
                              ? ` · @${service.provider_username}`
                              : ""}
                            {" · "}
                            {t("savedOn", {
                              date: dateFormatter.format(new Date(row.created_at)),
                            })}
                          </div>
                        </div>
                        <SaveButton targetId={service.id} targetType="service" saved />
                      </CardContent>
                    </Card>
                  ) : null,
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
