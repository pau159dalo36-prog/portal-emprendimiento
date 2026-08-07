import { getTranslations } from "next-intl/server";
import { ArrowRight, Compass, Rocket } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { CategoryStrip } from "@/components/feed/category-strip";
import { EmptyFeed } from "@/components/feed/empty-feed";
import { OrganizationRow } from "@/components/feed/organization-row";
import { ProjectGrid } from "@/components/feed/project-grid";
import { ProjectNeedsRow } from "@/components/feed/project-needs-row";
import { AppShell } from "@/components/navigation/app-shell";
import { VideoRail } from "@/components/video/video-rail";
import { ShortVideosRail } from "@/components/video/short-videos-rail";
import { buttonVariants } from "@/components/ui/button";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import {
  countPublishedProjectsByOrganizations,
  listOrganizations,
} from "@/organizations/data";
import {
  countOpenNeedsByProject,
  listOpenProjectNeeds,
  listPublishedProjects,
} from "@/projects/data";
import { listPublishedVideos } from "@/videos/data";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("home") };
}

function FeedSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("home");

  const [recommended, recentProjects, needs, organizations, publishedVideos] = await Promise.all([
    listPublishedProjects(supabase, { limit: 12, orderBy: "updated_at" }),
    listPublishedProjects(supabase, { limit: 8 }),
    listOpenProjectNeeds(supabase, { limit: 6 }),
    listOrganizations(supabase, { limit: 8 }),
    listPublishedVideos(supabase, { limit: 12 }),
  ]);

  const [recommendedNeeds, orgProjectCounts] = await Promise.all([
    countOpenNeedsByProject(
      supabase,
      recommended.map((project) => project.id),
    ),
    countPublishedProjectsByOrganizations(
      supabase,
      organizations.map((organization) => organization.id),
    ),
  ]);

  const hasContent =
    recommended.length > 0 ||
    recentProjects.length > 0 ||
    needs.length > 0 ||
    organizations.length > 0 ||
    publishedVideos.length > 0;

  return (
    <AppShell>
      <div className="grid gap-10">
        <section className="grid gap-4">
          <div className="grid gap-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("intro.eyebrow")}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("intro.title")}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t("intro.description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={user ? "/proyectos/nuevo" : "/registrarse"}
              className={buttonVariants()}
            >
              <Rocket className="size-4" aria-hidden="true" />
              {user ? t("intro.publishCta") : t("intro.createAccount")}
            </Link>
            <Link
              href="/proyectos"
              className={buttonVariants({ variant: "outline" })}
            >
              <Compass className="size-4" aria-hidden="true" />
              {t("intro.exploreCta")}
            </Link>
          </div>
        </section>

        <CategoryStrip />

        {hasContent ? (
          <>
            {recommended.length > 0 && (
              <FeedSection
                title={t("sections.recommended.title")}
                subtitle={t("sections.recommended.subtitle")}
                action={
                  <Link
                    href="/proyectos"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t("sections.recommended.viewAll")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                }
              >
                <ProjectGrid projects={recommended} needsCounts={recommendedNeeds} />
              </FeedSection>
            )}

            {needs.length > 0 && (
              <FeedSection
                title={t("sections.needs.title")}
                subtitle={t("sections.needs.subtitle")}
              >
                <div className="grid gap-3">
                  {needs.map((need) => (
                    <ProjectNeedsRow key={need.id} need={need} />
                  ))}
                </div>
              </FeedSection>
            )}

            {publishedVideos.length > 0 && <VideoRail videos={publishedVideos} />}

            <ShortVideosRail videos={publishedVideos} />

            {organizations.length > 0 && (
              <FeedSection
                title={t("sections.organizations.title")}
                subtitle={t("sections.organizations.subtitle")}
                action={
                  <Link
                    href="/organizaciones"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t("sections.organizations.viewAll")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                }
              >
                <div className="grid gap-3">
                  {organizations.map((organization) => (
                    <OrganizationRow
                      key={organization.id}
                      organization={organization}
                      projectCount={orgProjectCounts.get(organization.id) ?? 0}
                    />
                  ))}
                </div>
              </FeedSection>
            )}

            {recentProjects.length > 0 && (
              <FeedSection
                title={t("sections.recent.title")}
                subtitle={t("sections.recent.subtitle")}
                action={
                  <Link
                    href="/proyectos"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t("sections.recent.viewAll")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                }
              >
                <ProjectGrid projects={recentProjects} columns={4} />
              </FeedSection>
            )}
          </>
        ) : (
          <EmptyFeed />
        )}
      </div>
    </AppShell>
  );
}
