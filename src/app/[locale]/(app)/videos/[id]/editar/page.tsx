import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { VideoPublicationForm } from "@/components/video/video-publication-form";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
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
    </div>
  );
}
