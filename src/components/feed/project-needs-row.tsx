import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ProjectNeedWithProject } from "@/projects/data";

type ProjectNeedsRowProps = {
  need: ProjectNeedWithProject;
};

export async function ProjectNeedsRow({ need }: ProjectNeedsRowProps) {
  const t = await getTranslations("feed");
  const needStatuses = await getTranslations("needStatuses");

  if (!need.project) {
    return null;
  }

  return (
    <Link
      href={`/proyectos/${need.project.slug}`}
      className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold">{need.title}</h3>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {t("inProject", { name: need.project.name })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {need.skill && (
            <Badge className="border-border bg-muted text-muted-foreground">
              {need.skill.name}
            </Badge>
          )}
          {need.commitment && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              {need.commitment}
            </span>
          )}
          <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            {needStatuses("open")}
          </Badge>
        </div>
      </div>

      <ArrowRight
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
