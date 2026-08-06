import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { VideoImageUploader } from "@/components/video/video-image-uploader";
import { VideoPublicationForm } from "@/components/video/video-publication-form";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { resolveVideoImagePreviewUrl } from "@/lib/video/preview";
import { listProjectsForUser } from "@/projects/data";
import { getVideoById } from "@/videos/data";

type EditVideoPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata() {
  return { title: await pageMetadataTitle("editVideo") };
}

export default async function EditVideoPage({ params }: EditVideoPageProps) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("videos");

  const video = await getVideoById(supabase, id);
  if (!video || video.owner_id !== user.id) {
    notFound();
  }

  const projects = await listProjectsForUser(supabase, user.id);

  const [thumbnailSrc, posterSrc] = await Promise.all([
    resolveVideoImagePreviewUrl(supabase, {
      bucket: video.thumbnail_bucket,
      path: video.thumbnail_path,
    }),
    resolveVideoImagePreviewUrl(supabase, {
      bucket: video.poster_bucket,
      path: video.poster_path,
    }),
  ]);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("editDescription")}</p>
      </div>

      <Card>
        <CardContent>
          <VideoPublicationForm
            videoId={id}
            video={video}
            projects={projects.map((project) => ({ id: project.id, name: project.name, slug: project.slug }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <VideoImageUploader videoId={id} thumbnailSrc={thumbnailSrc} posterSrc={posterSrc} />
        </CardContent>
      </Card>
    </div>
  );
}
