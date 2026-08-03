import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/auth/session";
import { ProjectGrid } from "@/components/feed/project-grid";
import { ProjectFilters } from "@/components/projects/project-filters";
import { ProjectSort } from "@/components/projects/project-sort";
import { buttonVariants } from "@/components/ui/button";
import { INDUSTRIES } from "@/organizations/constants";
import { PROJECT_STAGES } from "@/projects/constants";
import {
  countOpenNeedsByProject,
  listPublishedProjects,
} from "@/projects/data";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";

type ExploreProjectsPageProps = {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    industry?: string;
    order?: string;
  }>;
};

export async function generateMetadata() {
  return { title: await pageMetadataTitle("projects") };
}

export default async function ExploreProjectsPage({
  searchParams,
}: ExploreProjectsPageProps) {
  const { q, stage, industry, order } = await searchParams;
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("projects");

  const validStage =
    stage && PROJECT_STAGES.includes(stage as (typeof PROJECT_STAGES)[number])
      ? stage
      : undefined;
  const validIndustry =
    industry && INDUSTRIES.includes(industry as (typeof INDUSTRIES)[number])
      ? industry
      : undefined;
  const orderBy: "created_at" | "updated_at" = order === "activos" ? "updated_at" : "created_at";

  const projects = await listPublishedProjects(supabase, {
    search: q?.trim() || undefined,
    stage: validStage,
    industry: validIndustry,
    orderBy,
  });

  const needsCounts = await countOpenNeedsByProject(
    supabase,
    projects.map((project) => project.id),
  );

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

      <ProjectFilters
        initialSearch={q ?? ""}
        initialStage={validStage ?? ""}
        initialIndustry={validIndustry ?? ""}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("resultCount", { count: projects.length })}
        </p>
        <ProjectSort
          search={q?.trim() ?? ""}
          stage={validStage ?? ""}
          industry={validIndustry ?? ""}
          initialOrder={order ?? "recientes"}
        />
      </div>

      {projects.length > 0 ? (
        <ProjectGrid projects={projects} needsCounts={needsCounts} />
      ) : (
        <div className="grid gap-1 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}
    </div>
  );
}
