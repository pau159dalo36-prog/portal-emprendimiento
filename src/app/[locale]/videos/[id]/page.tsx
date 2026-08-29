import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { ReportButton } from "@/components/reports/report-button";
import { getPublicVideoViewsCount } from "@/analytics/data";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CommentSection } from "@/components/interactions/comment-section";
import { SaveButton } from "@/components/interactions/save-button";
import { SupportButton } from "@/components/interactions/support-button";
import { VideoPlayer } from "@/components/video/video-player";
import { brand } from "@/config/brand";
import {
  getLanguageLabel,
  getVisibilityLabel,
  VIDEO_DISTRIBUTABLE_MODERATION_STATUSES,
  type VideoVisibility,
} from "@/config/video";
import { createSupabaseVideoProvider } from "@/lib/video/supabase-video-provider";
import { resolveVideoImagePreviewUrl } from "@/lib/video/preview";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { getPostByVideoId } from "@/posts/data";
import { getPostInteractionCounts, isPostSupportedBy } from "@/interactions/reactions";
import { isSaved } from "@/interactions/saves";
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
  const statuses = await getTranslations("videoStatuses");
  const moderation = await getTranslations("moderationStatuses");
  const form = await getTranslations("videoForm");

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const video = await getVideoById(supabase, id);
  if (!video) {
    notFound();
  }

  const isOwner = user?.id === video.owner_id;
  let isAdmin = false;
  if (user) {
    const { data: claims } = await supabase.auth.getClaims();
    isAdmin = claims?.claims?.app_metadata?.role === "admin";
  }

  const provider = createSupabaseVideoProvider(supabase);
  const playbackUrl = await provider.resolvePlaybackUrl(
    { bucket: video.storage_bucket, path: video.storage_path },
    video.visibility as VideoVisibility,
  );
  const poster = await resolveVideoImagePreviewUrl(supabase, {
    bucket: video.poster_bucket,
    path: video.poster_path,
  });

  // Contador público: solo tiene sentido en vídeos públicamente distribuibles
  // (published + ready + distributable + visibility public/unlisted). Para el
  // resto se oculta (la RPC devolvería 0 y no es un vector para sondear IDs).
  const isPubliclyCountable =
    video.status === "published" &&
    video.processing_status === "ready" &&
    (video.visibility === "public" || video.visibility === "unlisted") &&
    (VIDEO_DISTRIBUTABLE_MODERATION_STATUSES as readonly string[]).includes(
      video.moderation_status,
    );
  const viewsCount = isPubliclyCountable
    ? await getPublicVideoViewsCount(supabase, video.id)
    : null;

  // Interacciones (FASE 9): solo sobre el post público y distribuible del
  // vídeo. Draft/hidden/removed/rejected/flagged quedan fuera por diseño.
  const post = await getPostByVideoId(supabase, video.id);
  const isInteractable =
    isPubliclyCountable &&
    !!post &&
    post.visibility === "public" &&
    post.publication_status === "published";

  const interactionCounts = isInteractable && post
    ? (await getPostInteractionCounts(supabase, [post.id])).get(post.id) ?? {
        postId: post.id,
        commentCount: 0,
        supportCount: 0,
      }
    : null;
  const [supported, saved] = user && post && isInteractable
    ? await Promise.all([
        isPostSupportedBy(supabase, post.id, user.id),
        isSaved(supabase, user.id, "post", post.id),
      ])
    : [false, false];

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <VideoPlayer src={playbackUrl} poster={poster} videoId={video.id} />

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{video.title}</h1>
          {video.original_language && (
            <Badge className="border-border bg-muted text-muted-foreground">
              {getLanguageLabel(video.original_language)}
            </Badge>
          )}
          {isOwner && (
            <Badge className="border-border bg-muted text-muted-foreground">
              {statuses(video.status as Parameters<typeof statuses>[0])}
            </Badge>
          )}
          {isOwner &&
            (video.moderation_status === "rejected" ||
              video.moderation_status === "flagged") && (
              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {moderation(video.moderation_status as Parameters<typeof moderation>[0])}
              </Badge>
            )}
          {isAdmin && !isOwner && (
            <Badge className="border-border bg-muted text-muted-foreground">
              {statuses(video.status as Parameters<typeof statuses>[0])}
            </Badge>
          )}
          {isOwner && (
            <Badge className="border-border bg-muted text-muted-foreground">
              {form(`visibility.${getVisibilityLabel(video.visibility)}`)}
            </Badge>
          )}
        </div>

        {video.caption && (
          <p className="text-sm leading-6 text-muted-foreground">{video.caption}</p>
        )}

        {isOwner && video.moderation_reason && (
          <p className="text-sm text-muted-foreground">
            {t("moderationReason", { reason: video.moderation_reason })}
          </p>
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
          {viewsCount != null && (
            <span aria-label={t("viewsCount", { count: viewsCount })}>
              {t("viewsCount", { count: viewsCount })}
            </span>
          )}
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

        {video.organization && (
          <p className="text-sm">
            {t("inOrganization")}{" "}
            <Link
              href={`/organizaciones/${video.organization.slug}`}
              className="font-medium text-primary hover:underline"
            >
              {video.organization.name}
            </Link>
          </p>
        )}

        {isInteractable && post && interactionCounts && (
          <div className="flex flex-wrap items-center gap-2">
            <SupportButton
              postId={post.id}
              supported={supported}
              count={interactionCounts.supportCount}
            />
            <SaveButton targetId={post.id} targetType="post" saved={saved} />
            {user && !isOwner && <ReportButton targetType="post" targetId={post.id} />}
          </div>
        )}
      </div>

      {isInteractable && post && (
        <CommentSection postId={post.id} commentCount={interactionCounts?.commentCount ?? 0} />
      )}

      {isOwner && (
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
