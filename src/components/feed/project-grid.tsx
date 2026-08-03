import { ProjectVideoCard } from "@/components/feed/project-video-card";
import { cn } from "@/lib/utils";
import type { ProjectWithDetails } from "@/projects/data";

type ProjectGridProps = {
  projects: ProjectWithDetails[];
  needsCounts?: Map<string, number>;
  columns?: 2 | 3 | 4;
  className?: string;
};

const gridClasses = {
  2: "grid gap-4 sm:grid-cols-2",
  3: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
} as const;

export function ProjectGrid({
  projects,
  needsCounts,
  columns = 3,
  className,
}: ProjectGridProps) {
  return (
    <div className={cn(gridClasses[columns], className)}>
      {projects.map((project) => (
        <ProjectVideoCard
          key={project.id}
          project={project}
          needsCount={needsCounts?.get(project.id) ?? 0}
        />
      ))}
    </div>
  );
}
