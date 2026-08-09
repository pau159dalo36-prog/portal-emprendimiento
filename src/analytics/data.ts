import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { MAX_WATCH_DELTA_PER_REPORT } from "@/analytics/config";
import { postIdSchema, reportVideoViewInputSchema, videoIdSchema } from "@/analytics/schemas";
import type { ReportVideoViewResult, VideoMetrics } from "@/analytics/types";

export type ReportVideoViewParams = {
  videoId: string;
  anonymousSessionId?: string | null;
  watchDelta: number;
  progress: number;
};

// Única vía de escritura de analytics. Devuelve null ante cualquier fallo
// (petición inválida o error del servidor): el player nunca debe romperse por
// un problema de métricas.
export async function reportVideoView(
  supabase: SupabaseClient<Database>,
  params: ReportVideoViewParams,
): Promise<ReportVideoViewResult | null> {
  const parsed = reportVideoViewInputSchema.safeParse(params);
  if (!parsed.success) return null;

  const { data, error } = await supabase.rpc("report_video_view", {
    p_video_id: parsed.data.videoId,
    p_anonymous_session_id: parsed.data.anonymousSessionId ?? undefined,
    p_watch_delta: Math.min(parsed.data.watchDelta, MAX_WATCH_DELTA_PER_REPORT),
    p_progress: parsed.data.progress,
  });

  if (error) return null;
  return data?.[0] ?? null;
}

// Métricas agregadas del propietario (o admin). Fail-closed: ante error o
// petición inválida devuelve null.
export async function getVideoMetrics(
  supabase: SupabaseClient<Database>,
  videoId: string,
): Promise<VideoMetrics | null> {
  if (!videoIdSchema.safeParse(videoId).success) return null;

  const { data, error } = await supabase.rpc("get_video_metrics", { p_video_id: videoId });
  if (error) return null;
  return data?.[0] ?? null;
}

export async function getPostMetrics(
  supabase: SupabaseClient<Database>,
  postId: string,
): Promise<VideoMetrics | null> {
  if (!postIdSchema.safeParse(postId).success) return null;

  const { data, error } = await supabase.rpc("get_post_metrics", { p_post_id: postId });
  if (error) return null;
  return data?.[0] ?? null;
}

// Contador público de vistas cualificadas de un vídeo distribuible. Fail-closed:
// ante error devuelve null (el render no debe romperse).
export async function getPublicVideoViewsCount(
  supabase: SupabaseClient<Database>,
  videoId: string,
): Promise<number | null> {
  if (!videoIdSchema.safeParse(videoId).success) return null;

  const { data, error } = await supabase.rpc("get_public_video_views_count", {
    p_video_id: videoId,
  });
  if (error) return null;
  return data ?? null;
}
