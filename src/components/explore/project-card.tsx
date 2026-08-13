"use client";

import { useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  hashCode,
  PROJECT_FALLBACK_GRADIENTS,
  PROJECT_STAGE_DOTS,
} from "@/lib/project-visuals";
import type { SearchProject } from "@/search/types";

type ProjectCardProps = {
  project: SearchProject;
};

// Tarjeta de un proyecto en el hub Explorar. Reutiliza el aspecto visual de las
// tarjetas de proyectos del feed (gradientes, punto de etapa) pero en client:
// los ids de traducción (stage/industry) son keys conocidas.
export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations("explore");
  const stages = useTranslations("projectStages");
  const industries = useTranslations("industries");

  const creatorName = project.owner?.fullName ?? project.owner?.username ?? t("anonymous");
  const gradient =
    PROJECT_FALLBACK_GRADIENTS[hashCode(project.id) % PROJECT_FALLBACK_GRADIENTS.length];
  const initial = project.name.trim().charAt(0).toUpperCase() || "I";

  return (
    <Link
      href={`/proyectos/${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
        {project.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}>
            <span aria-hidden="true" className="select-none text-6xl font-black leading-none text-white/15">
              {initial}
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2">
          <Badge className="border-0 bg-black/50 text-white backdrop-blur-md">
            <span
              className={cn(
                "size-1.5 rounded-full",
                PROJECT_STAGE_DOTS[project.stage] ?? PROJECT_STAGE_DOTS.idea,
              )}
              aria-hidden="true"
            />
            {stages(project.stage)}
          </Badge>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">{project.name}</h3>
        {project.tagline && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{project.tagline}</p>
        )}

        {project.industries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.industries.map((industry) => (
              <Badge key={industry} className="border-border bg-muted text-muted-foreground">
                {industries(industry)}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2 text-sm text-muted-foreground">
          <Avatar name={project.owner?.fullName ?? null} src={project.owner?.avatarUrl} size="sm" />
          <span className="min-w-0 truncate">{creatorName}</span>
          {project.organization && (
            <span className="ml-auto shrink-0 truncate text-muted-foreground/80">
              {t("inProject", { name: project.organization.name })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
