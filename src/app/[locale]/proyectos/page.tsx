import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/auth/session";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFilters } from "@/components/projects/project-filters";
import { buttonVariants } from "@/components/ui/button";
import { PROJECT_STAGES } from "@/projects/constants";
import { listPublishedProjects } from "@/projects/data";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";

type ExploreProjectsPageProps = {
  searchParams: Promise<{ q?: string; stage?: string }>;
};

export async function generateMetadata() {
  return { title: await pageMetadataTitle("projects") };
}

export default async function ExploreProjectsPage({
  searchParams,
}: ExploreProjectsPageProps) {
  const { q, stage } = await searchParams;
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("projects");

  const validStage = stage && PROJECT_STAGES.includes(stage as (typeof PROJECT_STAGES)[number])
    ? stage
    : undefined;

  const projects = await listPublishedProjects(supabase, {
    search: q?.trim() || undefined,
    stage: validStage,
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {user && (
          <Link href="/proyectos/nuevo" className={buttonVariants()}>
            {t("newTitle")}
          </Link>
        )}
      </div>

      <ProjectFilters initialSearch={q ?? ""} initialStage={validStage ?? ""} />

      {projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="grid gap-1">
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}
    </div>
  );
}
