import { getTranslations } from "next-intl/server";
import { Video } from "lucide-react";

import { VideoCard } from "@/components/video/video-card";
import type { VideoWithDetails } from "@/videos/types";

type VideoRailProps = {
  videos: VideoWithDetails[];
};

export async function VideoRail({ videos }: VideoRailProps) {
  if (videos.length === 0) {
    return null;
  }

  const t = await getTranslations("videos");

  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Video className="size-5 text-primary" aria-hidden="true" />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}
