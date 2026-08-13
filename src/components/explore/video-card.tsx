"use client";

import { useTranslations } from "next-intl";
import { Play } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import { getSupabaseUrl } from "@/lib/env";
import { formatDurationSeconds, getVideoImageUrl } from "@/lib/video/utils";
import type { SearchVideo } from "@/search/types";

type VideoCardProps = {
  video: SearchVideo;
};

// Tarjeta de un vídeo en el hub Explorar. Mismo patrón visual que el feed:
// miniatura + duración, título, autor y ámbito (proyecto/organización).
export function VideoCard({ video }: VideoCardProps) {
  const t = useTranslations("explore");

  const thumbnail = getVideoImageUrl(
    getSupabaseUrl(),
    video.thumbnailBucket,
    video.thumbnailPath,
  );
  const duration = formatDurationSeconds(video.durationSeconds);
  const authorName = video.owner?.fullName ?? video.owner?.username ?? t("anonymous");
  const scopeName = video.project?.name ?? video.organization?.name;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
      <Link
        href={`/videos/${video.id}`}
        className="relative block aspect-video w-full shrink-0 overflow-hidden bg-muted"
      >
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
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          <Link href={`/videos/${video.id}`} className="focus-visible:outline-none">
            {video.title}
          </Link>
        </h3>
        {video.caption && (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{video.caption}</p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1.5 text-xs text-muted-foreground">
          <Avatar name={video.owner?.fullName ?? null} src={video.owner?.avatarUrl} size="sm" />
          <span className="min-w-0 truncate">{authorName}</span>
          {scopeName && (
            <span className="ml-auto shrink-0 truncate text-muted-foreground/80">
              {t("inProject", { name: scopeName })}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
