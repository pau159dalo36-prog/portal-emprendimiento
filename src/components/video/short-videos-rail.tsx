import { getTranslations } from "next-intl/server";
import { Video } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { VideoShortCard } from "@/components/video/video-short-card";
import { resolveVideoThumbnails } from "@/lib/video/preview";
import { isVerticalVideo } from "@/videos/data";
import type { VideoWithDetails } from "@/videos/types";

type ShortVideosRailProps = {
  videos: VideoWithDetails[];
};

export async function ShortVideosRail({ videos }: ShortVideosRailProps) {
  const shortVideos = videos.filter(isVerticalVideo);
  if (shortVideos.length === 0) {
    return null;
  }

  const t = await getTranslations("feed");
  const { supabase } = await getCurrentUser();
  const thumbnails = await resolveVideoThumbnails(supabase, shortVideos);

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
        {shortVideos.map((video) => (
          <VideoShortCard
            key={video.id}
            video={video}
            thumbnailSrc={thumbnails.get(video.id) ?? null}
            className="w-36 shrink-0 sm:w-44"
          />
        ))}
      </div>
    </section>
  );
}

