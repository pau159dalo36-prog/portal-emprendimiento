import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { VIDEO_BUCKET_PRIVATE, VIDEO_BUCKET_PUBLIC, VIDEO_THUMBNAILS_BUCKET } from "@/config/uploads";
import type { VideoVisibility } from "@/config/video";
import type { VideoProvider } from "@/lib/video/video-provider";
import type { StorageObjectRef } from "@/lib/video/types";
import { getPublicObjectUrl } from "@/lib/video/utils";
import { getSupabaseUrl } from "@/lib/env";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export function createSupabaseVideoProvider(supabase: SupabaseClient<Database>): VideoProvider {
  return {
    videoPublicBucket: VIDEO_BUCKET_PUBLIC,
    videoPrivateBucket: VIDEO_BUCKET_PRIVATE,
    thumbnailsBucket: VIDEO_THUMBNAILS_BUCKET,

    chooseVideoBucket(visibility: VideoVisibility): string {
      return visibility === "public" || visibility === "unlisted"
        ? VIDEO_BUCKET_PUBLIC
        : VIDEO_BUCKET_PRIVATE;
    },

    getPublicUrl({ bucket, path }: StorageObjectRef): string {
      return getPublicObjectUrl(getSupabaseUrl(), bucket, path);
    },

    async resolvePlaybackUrl(ref: StorageObjectRef, visibility: VideoVisibility): Promise<string> {
      const isPubliclyListable = visibility === "public" || visibility === "unlisted";
      if (ref.bucket === VIDEO_BUCKET_PUBLIC || isPubliclyListable) {
        return getPublicObjectUrl(getSupabaseUrl(), ref.bucket, ref.path);
      }

      const { data } = await supabase.storage
        .from(ref.bucket)
        .createSignedUrl(ref.path, SIGNED_URL_EXPIRY_SECONDS);

      return data?.signedUrl ?? getPublicObjectUrl(getSupabaseUrl(), ref.bucket, ref.path);
    },
  };
}
