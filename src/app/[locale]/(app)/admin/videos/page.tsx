import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/auth/admin";
import { VideoModerationForm } from "@/components/video/video-moderation-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { listVideosForModeration } from "@/videos/data";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("adminVideos") };
}

export default async function AdminVideosPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("moderation");
  const statuses = await getTranslations("moderationStatuses");

  const videos = await listVideosForModeration(supabase);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-3">
          {videos.map((video) => (
            <Card key={video.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="border-border bg-muted text-muted-foreground">
                    {statuses(video.moderation_status as Parameters<typeof statuses>[0])}
                  </Badge>
                </div>
                <VideoModerationForm
                  video={{
                    id: video.id,
                    title: video.title,
                    caption: video.caption,
                    ownerName: video.owner?.full_name ?? null,
                    ownerUsername: video.owner?.username ?? null,
                    visibility: video.visibility,
                    moderationStatus: video.moderation_status,
                    moderationReason: video.moderation_reason,
                    createdAt: video.created_at,
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
