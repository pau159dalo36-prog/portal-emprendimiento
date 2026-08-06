import type { VideoVisibility } from "@/config/video";
import type { StorageObjectRef } from "@/lib/video/types";

export interface VideoProvider {
  readonly videoPublicBucket: string;
  readonly videoPrivateBucket: string;
  readonly thumbnailsBucket: string;

  chooseVideoBucket(visibility: VideoVisibility): string;

  getPublicUrl(ref: StorageObjectRef): string;

  resolvePlaybackUrl(ref: StorageObjectRef, visibility: VideoVisibility): Promise<string>;
}

export type { StorageObjectRef } from "@/lib/video/types";
