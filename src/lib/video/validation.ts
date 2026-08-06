import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_CAPTION_FILE_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_UPLOAD_BYTES,
} from "@/config/uploads";

export const EXTRACTABLE_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;
export const IMAGE_MIME_TYPES = ALLOWED_IMAGE_MIME_TYPES;

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  vtt: "text/vtt",
};

export function normalizeMime(type: string, filename: string): string {
  const lower = type.toLowerCase().trim();
  if (lower) {
    return lower;
  }
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "";
}

export type VideoFileErrorKey = "noFile" | "tooLarge" | "badFormat";

export function validateVideoFile(file: File | null): VideoFileErrorKey | null {
  if (!file || file.size === 0) {
    return "noFile";
  }
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
    return "tooLarge";
  }
  const mime = normalizeMime(file.type, file.name);
  if (!(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mime)) {
    return "badFormat";
  }
  return null;
}

export type VideoMetadataInput = {
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
};

export type VideoMetadataErrorKey = "invalidMetadata" | "durationTooLong";

export function validateVideoMetadata(metadata: VideoMetadataInput): VideoMetadataErrorKey | null {
  if (metadata.durationSeconds == null) {
    return null;
  }
  if (!Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds < 0) {
    return "invalidMetadata";
  }
  if (metadata.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    return "durationTooLong";
  }
  return null;
}

export type ImageFileErrorKey = "thumbnailRequired" | "thumbnailTooLarge" | "thumbnailBadFormat";

export function validateImageFile(file: File | null): ImageFileErrorKey | null {
  if (!file || file.size === 0) {
    return "thumbnailRequired";
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return "thumbnailTooLarge";
  }
  const mime = normalizeMime(file.type, file.name);
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
    return "thumbnailBadFormat";
  }
  return null;
}

export type CaptionFileErrorKey = "captionRequired" | "captionTooLarge" | "captionBadFormat";

export function validateCaptionFile(file: File | null): CaptionFileErrorKey | null {
  if (!file || file.size === 0) {
    return "captionRequired";
  }
  if (file.size > MAX_CAPTION_FILE_BYTES) {
    return "captionTooLarge";
  }
  const mime = normalizeMime(file.type, file.name);
  if (mime && mime !== "text/vtt" && mime !== "application/octet-stream" && mime !== "text/plain") {
    return "captionBadFormat";
  }
  return null;
}
