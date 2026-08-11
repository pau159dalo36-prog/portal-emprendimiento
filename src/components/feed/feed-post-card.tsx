"use client";

import { useTranslations } from "next-intl";
import { Play } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import type { PublicFeedItem } from "@/feed/types";
import { Link } from "@/i18n/navigation";
import { getSupabaseUrl } from "@/lib/env";
import { formatDurationSeconds, getVideoImageUrl } from "@/lib/video/utils";
import { cn } from "@/lib/utils";

type FeedPostCardProps = {
  item: PublicFeedItem;
  className?: string;
};

// Tarjeta de un post del feed (vídeo + autor + proyecto/organización + vistas
// públicas agregadas). Recibe UN FeedItem ya mapeado por la capa de datos (sin
// scores: PublicFeedItem no los incluye).
export function FeedPostCard({ item, className }: FeedPostCardProps) {
  const videosT = useTranslations("videos");
  const feedT = useTranslations("feed");

  const video = item.video;
  const thumbnail = video
    ? getVideoImageUrl(getSupabaseUrl(), video.thumbnailBucket, video.thumbnailPath)
    : null;
  const duration = formatDurationSeconds(video?.durationSeconds ?? null);
  const authorName = item.author?.fullName ?? item.author?.username ?? feedT("anonymous");
  const scopeName = item.project?.name ?? item.organization?.name;
  const caption = video?.caption ?? item.post.body;

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
    >
      <Link
        href={`/videos/${video?.id ?? ""}`}
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
          <Link href={`/videos/${video?.id ?? ""}`} className="focus-visible:outline-none">
            {video?.title ?? item.post.body ?? "…"}
          </Link>
        </h3>
        {caption && <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{caption}</p>}

        <div className="mt-auto flex items-center gap-2 pt-1.5 text-xs text-muted-foreground">
          <Avatar name={authorName} src={item.author?.avatarUrl} size="sm" />
          <span className="min-w-0 truncate">{authorName}</span>
          {scopeName && (
            <span className="ml-auto shrink-0 truncate text-muted-foreground/80">
              {feedT("inProject", { name: scopeName })}
            </span>
          )}
        </div>

        {item.metrics.qualifiedViews > 0 && (
          <p className="text-xs text-muted-foreground">
            {videosT("viewsCount", { count: item.metrics.qualifiedViews })}
          </p>
        )}
      </div>
    </article>
  );
}
