"use client";

import { cn } from "@/lib/utils";

type VideoPlayerProps = {
  src: string;
  poster?: string | null;
  className?: string;
};

export function VideoPlayer({ src, poster, className }: VideoPlayerProps) {
  return (
    <video
      className={cn("aspect-video w-full rounded-2xl border border-border/60 bg-black", className)}
      src={src}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="metadata"
    />
  );
}
