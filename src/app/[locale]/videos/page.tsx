import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/auth/session";
import { VideoCard } from "@/components/video/video-card";
import { VideoEmptyState } from "@/components/video/video-empty-state";
import { resolveVideoThumbnails } from "@/lib/video/preview";
import { pageMetadataTitle } from "@/i18n/metadata";
import { listPublishedVideos } from "@/videos/data";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("videos") };
}

export default async function VideosPage() {
  const { supabase } = await getCurrentUser();
  const t = await getTranslations("videos");

  const videos = await listPublishedVideos(supabase, { limit: 60 });
  const thumbnails = await resolveVideoThumbnails(supabase, videos);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {videos.length === 0 ? (
        <VideoEmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              thumbnailSrc={thumbnails.get(video.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
