import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ProjectWithDetails } from "@/projects/data";

export async function ProjectCard({ project }: { project: ProjectWithDetails }) {
  const stages = await getTranslations("projectStages");
  const industries = await getTranslations("industries");
  const t = await getTranslations("projects");

  return (
    <Link
      href={`/proyectos/${project.slug}`}
      className="group rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{project.name}</h2>
        <Badge className="border-primary/30 bg-primary/10 text-primary">
          {stages(project.stage as Parameters<typeof stages>[0])}
        </Badge>
      </div>

      {project.tagline && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {project.tagline}
        </p>
      )}

      {project.industries.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.industries.map((industry) => (
            <Badge key={industry} className="border-border bg-muted text-muted-foreground">
              {industries(industry as Parameters<typeof industries>[0])}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="truncate">
          {project.organization
            ? t("byOrganization", { name: project.organization.name })
            : t("noOrganization")}
        </span>
        {project.owner?.full_name && (
          <span className="shrink-0 truncate">
            {t("createdBy", { name: project.owner.full_name })}
          </span>
        )}
      </div>
    </Link>
  );
}
