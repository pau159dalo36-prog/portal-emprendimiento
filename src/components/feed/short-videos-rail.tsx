import { getTranslations } from "next-intl/server";
import { Video } from "lucide-react";

import { ProjectVideoCard } from "@/components/feed/project-video-card";
import type { ProjectWithDetails } from "@/projects/data";

type ShortVideosRailProps = {
  videos: ProjectWithDetails[];
};

export async function ShortVideosRail({ videos }: ShortVideosRailProps) {
  if (videos.length === 0) {
    return null;
  }

  const t = await getTranslations("feed");

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Video className="size-5 text-primary" aria-hidden="true" />
          {t("videosTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("videosDescription")}</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((project) => (
          <ProjectVideoCard
            key={project.id}
            project={project}
            format="vertical"
            className="w-36 shrink-0 sm:w-44"
          />
        ))}
      </div>
    </section>
  );
}
