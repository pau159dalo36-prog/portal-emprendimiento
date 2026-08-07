import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getPublicObjectUrl } from "@/lib/video/utils";
import { getSupabaseUrl } from "@/lib/env";
import { VIDEO_THUMBNAILS_BUCKET } from "@/config/uploads";

export type VideoImagePreviewRef = { bucket: string | null; path: string | null } | null;

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export async function resolveVideoImagePreviewUrl(
  supabase: SupabaseClient<Database>,
  image: VideoImagePreviewRef,
): Promise<string | null> {
  if (!image?.bucket || !image.path) {
    return null;
  }
  const { data } = await supabase.storage.from(image.bucket).createSignedUrl(image.path, SIGNED_URL_EXPIRY_SECONDS);
  return data?.signedUrl ?? null;
}

export async function resolveVideoThumbnailUrl(
  supabase: SupabaseClient<Database>,
  image: VideoImagePreviewRef,
): Promise<string | null> {
  if (!image?.bucket || !image.path) {
    return null;
  }
  if (image.bucket === VIDEO_THUMBNAILS_BUCKET) {
    return getPublicObjectUrl(getSupabaseUrl(), image.bucket, image.path);
  }
  const { data } = await supabase.storage.from(image.bucket).createSignedUrl(image.path, SIGNED_URL_EXPIRY_SECONDS);
  return data?.signedUrl ?? null;
}

export async function resolveVideoThumbnails(
  supabase: SupabaseClient<Database>,
  videos: readonly { id: string; thumbnail_bucket: string | null; thumbnail_path: string | null }[],
): Promise<Map<string, string | null>> {
  const results = await Promise.all(
    videos.map((video) =>
      resolveVideoThumbnailUrl(supabase, {
        bucket: video.thumbnail_bucket,
        path: video.thumbnail_path,
      }),
    ),
  );
  const map = new Map<string, string | null>();
  videos.forEach((video, index) => {
    map.set(video.id, results[index] ?? null);
  });
  return map;
}
