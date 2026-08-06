import type { VideoVisibility } from "@/config/video";
import type { StorageObjectRef } from "@/lib/video/types";
import type { VideoProvider } from "@/lib/video/video-provider";
import { getVideoImageUrl } from "@/lib/video/utils";

export type VideoImageInput = { bucket: string | null; path: string | null } | null;

export type VideoPlaybackSource = {
  src: string;
  poster: string | null;
};

export function resolveVideoPlaybackUrl(
  provider: VideoProvider,
  ref: StorageObjectRef,
  visibility: VideoVisibility,
): Promise<string> {
  return provider.resolvePlaybackUrl(ref, visibility);
}

export function getVideoImageSrc(
  supabaseUrl: string,
  image: VideoImageInput,
): string | null {
  return getVideoImageUrl(supabaseUrl, image?.bucket ?? null, image?.path ?? null);
}

export async function buildPlaybackSource(
  provider: VideoProvider,
  options: {
    ref: StorageObjectRef;
    visibility: VideoVisibility;
    supabaseUrl: string;
    poster?: VideoImageInput;
  },
): Promise<VideoPlaybackSource> {
  const [src, poster] = await Promise.all([
    provider.resolvePlaybackUrl(options.ref, options.visibility),
    Promise.resolve(getVideoImageSrc(options.supabaseUrl, options.poster ?? null)),
  ]);
  return { src, poster };
}
