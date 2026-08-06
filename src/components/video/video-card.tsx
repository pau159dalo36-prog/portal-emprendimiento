import { getTranslations } from "next-intl/server";
import { Play } from "lucide-react";

import { getSupabaseUrl } from "@/lib/env";
import { formatDurationSeconds, getVideoImageUrl } from "@/lib/video/utils";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import type { VideoWithDetails } from "@/videos/types";

type VideoCardProps = {
  video: VideoWithDetails;
  className?: string;
};

export async function VideoCard({ video, className }: VideoCardProps) {
  const t = await getTranslations("videos");
  const supabaseUrl = getSupabaseUrl();
  const thumbnail = getVideoImageUrl(supabaseUrl, video.thumbnail_bucket, video.thumbnail_path);
  const duration = formatDurationSeconds(video.duration_seconds);

  return (
    <Link
      href={`/videos/${video.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600">
            <Play className="size-9 text-white/40" aria-hidden="true" />
          </div>
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            {duration}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{video.title}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {video.owner?.full_name ?? t("anonymous")}
        </p>
      </div>
    </Link>
  );
}
