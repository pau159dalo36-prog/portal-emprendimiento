import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video/video-player";
import { brand } from "@/config/brand";
import { getLanguageLabel, type VideoVisibility } from "@/config/video";
import { getSupabaseUrl } from "@/lib/env";
import { createSupabaseVideoProvider } from "@/lib/video/supabase-video-provider";
import { getVideoImageUrl } from "@/lib/video/utils";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { getVideoById } from "@/videos/data";

type VideoDetailPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({ params }: VideoDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await getCurrentUser();
  const video = await getVideoById(supabase, id);

  if (!video) {
    return { title: await pageMetadataTitle("videos") };
  }

  return {
    title: `${video.title} — ${brand.name}`,
    description: video.caption ?? undefined,
  };
}

export default async function VideoDetailPage({ params }: VideoDetailPageProps) {
  const { id, locale } = await params;
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("videos");

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const video = await getVideoById(supabase, id);
  if (!video) {
    notFound();
  }

  const provider = createSupabaseVideoProvider(supabase);
  const playbackUrl = await provider.resolvePlaybackUrl(
    { bucket: video.storage_bucket, path: video.storage_path },
    video.visibility as VideoVisibility,
  );
  const thumbnail = getVideoImageUrl(getSupabaseUrl(), video.thumbnail_bucket, video.thumbnail_path);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <VideoPlayer src={playbackUrl} poster={thumbnail} />

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{video.title}</h1>
          {video.original_language && (
            <Badge className="border-border bg-muted text-muted-foreground">
              {getLanguageLabel(video.original_language)}
            </Badge>
          )}
        </div>

        {video.caption && (
          <p className="text-sm leading-6 text-muted-foreground">{video.caption}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {video.owner && (
            <Link
              href={`/perfil/${video.owner.username ?? ""}`}
              className={`inline-flex items-center gap-2 hover:underline ${
                !video.owner.username ? "pointer-events-none" : ""
              }`}
            >
              <Avatar name={video.owner.full_name} src={video.owner.avatar_url} size="sm" />
              {video.owner.full_name ?? t("anonymous")}
            </Link>
          )}
          <span>
            {t("publishedOn", {
              date: dateFormatter.format(new Date(video.published_at ?? video.created_at)),
            })}
          </span>
        </div>

        {video.project && (
          <p className="text-sm">
            {t("inProject")}{" "}
            <Link
              href={`/proyectos/${video.project.slug}`}
              className="font-medium text-primary hover:underline"
            >
              {video.project.name}
            </Link>
          </p>
        )}
      </div>

      {user && video.owner_id === user.id && (
        <div>
          <Link href={`/videos/${video.id}/editar`} className={buttonVariants({ variant: "outline" })}>
            <Pencil aria-hidden="true" />
            {t("edit")}
          </Link>
        </div>
      )}
    </div>
  );
}
