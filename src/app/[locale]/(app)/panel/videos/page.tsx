import { getTranslations } from "next-intl/server";
import { Pencil, Play } from "lucide-react";

import { requireUser } from "@/auth/session";
import { changeVideoStatusAction } from "@/actions/videos";
import { VideoDeleteButton } from "@/components/video/video-delete-button";
import { VideoEmptyState } from "@/components/video/video-empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseUrl } from "@/lib/env";
import { getVideoImageUrl } from "@/lib/video/utils";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { listVideosForUser } from "@/videos/data";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("panelVideos") };
}

export default async function PanelVideosPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("videos");
  const statuses = await getTranslations("videoStatuses");

  const videos = await listVideosForUser(supabase, user.id);
  const supabaseUrl = getSupabaseUrl();

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

      {videos.length === 0 ? (
        <VideoEmptyState />
      ) : (
        <div className="grid gap-3">
          {videos.map((video) => {
            const canPublish = video.status !== "published" && video.status !== "removed";
            const isPublished = video.status === "published";
            const thumbnail = getVideoImageUrl(
              supabaseUrl,
              video.thumbnail_bucket,
              video.thumbnail_path,
            );
            return (
              <Card key={video.id}>
                <CardContent className="flex flex-wrap items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnail}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <Play className="size-5 text-white/40" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold">{video.title}</h2>
                      <Badge className="border-border bg-muted text-muted-foreground">
                        {statuses(video.status as Parameters<typeof statuses>[0])}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {video.caption || "—"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isPublished && (
                      <Link
                        href={`/videos/${video.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        {t("view")}
                      </Link>
                    )}
                    <Link
                      href={`/videos/${video.id}/editar`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <Pencil aria-hidden="true" />
                      {t("edit")}
                    </Link>

                    {canPublish && (
                      <form action={changeVideoStatusAction}>
                        <input type="hidden" name="video_id" value={video.id} />
                        <input type="hidden" name="status" value="published" />
                        <button type="submit" className={buttonVariants({ size: "sm" })}>
                          {t("publish")}
                        </button>
                      </form>
                    )}

                    {isPublished && (
                      <form action={changeVideoStatusAction}>
                        <input type="hidden" name="video_id" value={video.id} />
                        <input type="hidden" name="status" value="hidden" />
                        <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
                          {t("hide")}
                        </button>
                      </form>
                    )}

                    <VideoDeleteButton videoId={video.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
