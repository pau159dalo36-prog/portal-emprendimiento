import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import type { ProjectWithDetails } from "@/projects/data";

type ProjectVideoCardProps = {
  project: ProjectWithDetails;
  format?: "horizontal" | "vertical";
  needsCount?: number;
  className?: string;
};

const STAGE_DOTS: Record<string, string> = {
  idea: "bg-sky-400",
  validacion: "bg-amber-400",
  prototipo: "bg-violet-400",
  lanzamiento: "bg-emerald-400",
  crecimiento: "bg-rose-400",
};

const FALLBACK_GRADIENTS = [
  "from-slate-900 via-slate-800 to-slate-600",
  "from-indigo-950 via-indigo-900 to-slate-800",
  "from-teal-950 via-teal-900 to-slate-800",
  "from-rose-950 via-rose-900 to-slate-800",
  "from-amber-950 via-amber-900 to-slate-800",
  "from-violet-950 via-violet-900 to-slate-800",
] as const;

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function isOptimizableCover(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return true;
    }
    return new URL(supabaseUrl).hostname === hostname;
  } catch {
    return false;
  }
}

function ProjectThumbnail({ project }: { project: ProjectWithDetails }) {
  const cover = project.cover_image_url;

  if (cover) {
    return (
      <Image
        src={cover}
        alt={project.name}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        unoptimized={!isOptimizableCover(cover)}
      />
    );
  }

  const gradient = FALLBACK_GRADIENTS[hashCode(project.id) % FALLBACK_GRADIENTS.length];
  const initial = project.name.trim().charAt(0).toUpperCase() || "I";

  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}>
      <span
        aria-hidden="true"
        className="select-none text-7xl font-black leading-none text-white/15"
      >
        {initial}
      </span>
    </div>
  );
}

export async function ProjectVideoCard({
  project,
  format = "horizontal",
  needsCount = 0,
  className,
}: ProjectVideoCardProps) {
  const stages = await getTranslations("projectStages");
  const t = await getTranslations("feed");

  const isVertical = format === "vertical";
  const creatorName = project.owner?.full_name ?? project.organization?.name ?? t("anonymous");

  return (
    <Link
      href={`/proyectos/${project.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
    >
      <div
        className={cn(
          "relative w-full shrink-0 overflow-hidden bg-muted",
          isVertical ? "aspect-[9/16]" : "aspect-video",
        )}
      >
        <ProjectThumbnail project={project} />
        <div className="absolute left-2 top-2">
          <Badge className="border-0 bg-black/50 text-white backdrop-blur-md">
            <span
              className={cn("size-1.5 rounded-full", STAGE_DOTS[project.stage] ?? STAGE_DOTS.idea)}
              aria-hidden="true"
            />
            {stages(project.stage as Parameters<typeof stages>[0])}
          </Badge>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">{project.name}</h3>
        {project.tagline && !isVertical && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{project.tagline}</p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2 text-sm text-muted-foreground">
          <Avatar name={project.owner?.full_name ?? null} src={project.owner?.avatar_url} size="sm" />
          <span className="min-w-0 truncate">{creatorName}</span>
          {needsCount > 0 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
              <Users className="size-3" aria-hidden="true" />
              {t("needsCount", { count: needsCount })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
