import { cn } from "@/lib/utils";

export function VideoPlayerSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("aspect-video w-full animate-pulse rounded-2xl border border-border/60 bg-muted", className)}
    />
  );
}
