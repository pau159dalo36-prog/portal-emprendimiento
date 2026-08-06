import { VIDEO_BUCKET_PRIVATE, VIDEO_BUCKET_PUBLIC } from "@/config/uploads";
import { VIDEO_VISIBILITIES, type VideoVisibility } from "@/config/video";

export const PUBLIC_LISTING_VISIBILITIES = ["public", "unlisted"] as const;

export const PROTECTED_VISIBILITIES = [
  "registered_users",
  "project_members",
  "private",
] as const;

export const VISIBILITY_CLASSES = {
  public: [...PUBLIC_LISTING_VISIBILITIES] as readonly VideoVisibility[],
  protected: PROTECTED_VISIBILITIES,
} as const;

export type VideoVisibilityClass = keyof typeof VISIBILITY_CLASSES;

export function getVisibilityClass(visibility: string): VideoVisibilityClass | null {
  if ((PUBLIC_LISTING_VISIBILITIES as readonly string[]).includes(visibility)) {
    return "public";
  }
  if ((PROTECTED_VISIBILITIES as readonly string[]).includes(visibility)) {
    return "protected";
  }
  return null;
}

export function getBucketForVisibility(visibility: string): string | null {
  const visibilityClass = getVisibilityClass(visibility);
  if (visibilityClass === "public") {
    return VIDEO_BUCKET_PUBLIC;
  }
  if (visibilityClass === "protected") {
    return VIDEO_BUCKET_PRIVATE;
  }
  return null;
}

export function getClassForBucket(bucket: string | null): VideoVisibilityClass | null {
  if (bucket === VIDEO_BUCKET_PUBLIC) {
    return "public";
  }
  if (bucket === VIDEO_BUCKET_PRIVATE) {
    return "protected";
  }
  return null;
}

export function getVisibilitiesForClass(
  visibilityClass: VideoVisibilityClass | null,
): readonly VideoVisibility[] {
  if (visibilityClass === null) {
    return VIDEO_VISIBILITIES;
  }
  return VISIBILITY_CLASSES[visibilityClass];
}

export function canChangeVisibility(
  current: { visibility: string; processingStatus: string },
  nextVisibility: string,
): boolean {
  const currentClass = getVisibilityClass(current.visibility);
  const nextClass = getVisibilityClass(nextVisibility);
  if (currentClass === null || nextClass === null) {
    return false;
  }
  if (currentClass === nextClass) {
    return true;
  }
  return current.processingStatus === "uploading";
}

export function getPublishedVisibilityClause(): readonly string[] {
  return PUBLIC_LISTING_VISIBILITIES;
}

export function isPubliclyListable(visibility: string): boolean {
  return visibility === "public" || visibility === "unlisted";
}

export function isVideoViewableBy(
  video: { owner_id: string; visibility: string },
  userId: string | null,
): boolean {
  if (isPubliclyListable(video.visibility)) {
    return true;
  }
  if (!userId) {
    return false;
  }
  if (video.owner_id === userId) {
    return true;
  }
  return video.visibility === "registered_users";
}
