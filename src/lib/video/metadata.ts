import {
  EXTRACTABLE_VIDEO_MIME_TYPES,
  normalizeMime,
  type VideoMetadataInput,
} from "@/lib/video/validation";

const METADATA_TIMEOUT_MS = 10_000;

export function canExtractVideoMetadata(file: File): boolean {
  const mime = normalizeMime(file.type, file.name);
  return (EXTRACTABLE_VIDEO_MIME_TYPES as readonly string[]).includes(mime);
}

export async function extractVideoMetadata(file: File): Promise<VideoMetadataInput> {
  if (!canExtractVideoMetadata(file)) {
    return { durationSeconds: null, width: null, height: null };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const done = (metadata: VideoMetadataInput) => {
      if (settled) {
        return;
      }
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(metadata);
    };

    const timer = window.setTimeout(
      () => done({ durationSeconds: null, width: null, height: null }),
      METADATA_TIMEOUT_MS,
    );

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done({
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done({ durationSeconds: null, width: null, height: null });
    };
    video.src = objectUrl;
  });
}
