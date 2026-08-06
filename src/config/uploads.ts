export const MAX_VIDEO_UPLOAD_MB = 100;
export const MAX_VIDEO_UPLOAD_BYTES = MAX_VIDEO_UPLOAD_MB * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 180;
export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;
export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];

export const MAX_IMAGE_UPLOAD_MB = 5;
export const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_CAPTION_FILE_MB = 1;
export const MAX_CAPTION_FILE_BYTES = MAX_CAPTION_FILE_MB * 1024 * 1024;

export const VIDEO_BUCKET_PUBLIC = "public-videos";
export const VIDEO_BUCKET_PRIVATE = "private-videos";
export const VIDEO_THUMBNAILS_BUCKET = "video-thumbnails";

export const uploads = {
  avatar: {
    fileName: "avatar.webp",
    maxBytes: 5 * 1024 * 1024,
    maxDimension: 512,
    mimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/avif",
    ] as const,
    bucket: "avatars",
  },
  video: {
    maxBytes: MAX_VIDEO_UPLOAD_BYTES,
    maxDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
    mimeTypes: ALLOWED_VIDEO_MIME_TYPES,
    bucketPublic: VIDEO_BUCKET_PUBLIC,
    bucketPrivate: VIDEO_BUCKET_PRIVATE,
  },
  image: {
    maxBytes: MAX_IMAGE_UPLOAD_BYTES,
    mimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    bucket: VIDEO_THUMBNAILS_BUCKET,
  },
  caption: {
    maxBytes: MAX_CAPTION_FILE_BYTES,
  },
} as const;

export type UploadConfig = typeof uploads;
