import { getLocale, getTranslations } from "next-intl/server";
import { Archive, Eye, Pencil, Play, RotateCcw } from "lucide-react";

import { requireUser } from "@/auth/session";
import { changeVideoStatusAction } from "@/actions/videos";
import { getVideoMetrics } from "@/analytics/data";
import type { VideoMetrics } from "@/analytics/types";
import { VideoDeleteButton } from "@/components/video/video-delete-button";
import { VideoEmptyState } from "@/components/video/video-empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getVisibilityLabel } from "@/config/video";
import { formatDurationSeconds } from "@/lib/video/utils";
import { resolveVideoImagePreviewUrl } from "@/lib/video/preview";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { listVideosForUser } from "@/videos/data";
import {
  canArchiveVideo,
  canDeleteVideo,
  canEditVideo,
  canPublishVideo,
  canRetractVideo,
  canUnarchiveVideo,
  getPanelSection,
  PANEL_SECTION_ORDER,
  type PanelSectionKey,
} from "@/videos/panel";
import type { VideoWithDetails } from "@/videos/types";

async function VideoPanelCard({
  video,
  thumbnailUrl,
  metrics,
}: {
  video: VideoWithDetails;
  thumbnailUrl: string | null;
  metrics: VideoMetrics | null;
}) {
  const t = await getTranslations("videos");
  const statuses = await getTranslations("videoStatuses");
  const moderation = await getTranslations("moderationStatuses");
  const form = await getTranslations("videoForm");
  const locale = await getLocale();
  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isUploading = video.processing_status === "uploading";
  const isFailed = video.processing_status === "failed";
  const isPublished = video.status === "published";
  const isRejected = video.moderation_status === "rejected";
  const isModerationPending = video.moderation_status === "unreviewed" || video.moderation_status === "flagged";

  const publishable = canPublishVideo(video);
  const editable = canEditVideo(video);
  const archivable = canArchiveVideo(video);
  const unarchivable = canUnarchiveVideo(video);

  const duration = formatDurationSeconds(video.duration_seconds);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" className="size-full object-cover" />
          ) : (
            <Play className="size-6 text-white/40" aria-hidden="true" />
          )}
          {duration && (
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
              {duration}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{video.title}</h2>
            <Badge className="border-border bg-muted text-muted-foreground">
              {statuses(video.status as Parameters<typeof statuses>[0])}
            </Badge>
            {isUploading && (
              <Badge className="border-primary/30 bg-primary/10 text-primary">
                {statuses("uploading")}
              </Badge>
            )}
            {isFailed && (
              <Badge className="border-destructive/30 bg-destructive/10 text-destructive">
                {statuses("failed")}
              </Badge>
            )}
            {isModerationPending && (
              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {moderation(video.moderation_status as Parameters<typeof moderation>[0])}
              </Badge>
            )}
            {isRejected && (
              <Badge className="border-destructive/30 bg-destructive/10 text-destructive">
                {moderation("rejected")}
              </Badge>
            )}
            <Badge className="border-border bg-muted text-muted-foreground">
              {form(`visibility.${getVisibilityLabel(video.visibility)}`)}
            </Badge>
          </div>

          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {video.project?.name ?? t("noProject")}
          </p>

          {video.organization && (
            <p className="line-clamp-1 text-sm text-muted-foreground">
              {video.organization.name}
            </p>
          )}

          {video.moderation_reason && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {t("moderationReason", { reason: video.moderation_reason })}
            </p>
          )}

          <p className="mt-1 text-xs text-muted-foreground">
            {t("createdOn", {
              date: dateFormatter.format(new Date(video.created_at)),
            })}
            {video.published_at
              ? ` · ${t("publishedAtLabel", {
                  date: dateFormatter.format(new Date(video.published_at)),
                })}`
              : null}
          </p>

          {metrics && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("metrics.qualifiedViews", { count: metrics.qualified_views })}
              {" · "}
              {t("metrics.averageWatch", {
                seconds: Math.round(metrics.average_watch_seconds),
              })}
              {" · "}
              {t("metrics.averageProgress", {
                rate: Math.round(metrics.average_progress * 100),
              })}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isPublished && (
            <Link
              href={`/videos/${video.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Eye aria-hidden="true" />
              {t("view")}
            </Link>
          )}
          {editable && (
            <Link
              href={`/videos/${video.id}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil aria-hidden="true" />
              {t("edit")}
            </Link>
          )}

          {publishable && (
            <form action={changeVideoStatusAction}>
              <input type="hidden" name="video_id" value={video.id} />
              <input type="hidden" name="status" value="published" />
              <button type="submit" className={buttonVariants({ size: "sm" })}>
                {t("publish")}
              </button>
            </form>
          )}

          {canRetractVideo(video) && (
            <form action={changeVideoStatusAction}>
              <input type="hidden" name="video_id" value={video.id} />
              <input type="hidden" name="status" value="hidden" />
              <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
                {t("retract")}
              </button>
            </form>
          )}

          {archivable && (
            <form action={changeVideoStatusAction}>
              <input type="hidden" name="video_id" value={video.id} />
              <input type="hidden" name="status" value="archived" />
              <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Archive aria-hidden="true" />
                {t("archive")}
              </button>
            </form>
          )}

          {unarchivable && (
            <form action={changeVideoStatusAction}>
              <input type="hidden" name="video_id" value={video.id} />
              <input type="hidden" name="status" value="draft" />
              <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <RotateCcw aria-hidden="true" />
                {t("unarchive")}
              </button>
            </form>
          )}

          {canDeleteVideo(video) && <VideoDeleteButton videoId={video.id} />}
        </div>
      </CardContent>
    </Card>
  );
}

export async function generateMetadata() {
  return { title: await pageMetadataTitle("panelVideos") };
}

export default async function PanelVideosPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("videos");

  const videos = await listVideosForUser(supabase, user.id);

  const sections = new Map<PanelSectionKey, VideoWithDetails[]>();
  const previews = new Map<string, string | null>();
  const metricsByVideo = new Map<string, VideoMetrics | null>();
  for (const video of videos) {
    const key = getPanelSection(video);
    if (key) {
      sections.set(key, [...(sections.get(key) ?? []), video]);
      previews.set(
        video.id,
        await resolveVideoImagePreviewUrl(supabase, {
          bucket: video.thumbnail_bucket,
          path: video.thumbnail_path,
        }),
      );
      metricsByVideo.set(video.id, await getVideoMetrics(supabase, video.id));
    }
  }

  const ordered = PANEL_SECTION_ORDER.filter((key) => (sections.get(key)?.length ?? 0) > 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("panelTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("panelDescription")}</p>
        </div>
        <Link href="/publicar/video" className={buttonVariants()}>
          {t("newTitle")}
        </Link>
      </div>

      {ordered.length === 0 ? (
        <VideoEmptyState />
      ) : (
        <div className="grid gap-8">
          {ordered.map((key) => (
            <section key={key} className="grid gap-3">
              <div className="grid gap-1">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(`panelSections.${key}`)}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {sections.get(key)!.length}{" "}
                  {sections.get(key)!.length === 1 ? t("panelItem") : t("panelItems")}
                </p>
              </div>
              <div className="grid gap-3">
                {sections.get(key)!.map((video) => (
                  <VideoPanelCard
                    key={video.id}
                    video={video}
                    thumbnailUrl={previews.get(video.id) ?? null}
                    metrics={metricsByVideo.get(video.id) ?? null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
