import { extractVideoMetadata } from "@/lib/video/metadata";
import {
  validateCaptionFile,
  validateImageFile,
  validateVideoFile,
  validateVideoMetadata,
  type CaptionFileErrorKey,
  type ImageFileErrorKey,
  type VideoFileErrorKey,
  type VideoMetadataErrorKey,
  type VideoMetadataInput,
} from "@/lib/video/validation";

export type VideoFileValidationErrorKey = VideoFileErrorKey | VideoMetadataErrorKey;

export type VideoFileValidationResult =
  | { ok: true; metadata: VideoMetadataInput }
  | { ok: false; errorKey: VideoFileValidationErrorKey };

export async function validateVideoFileFull(file: File | null): Promise<VideoFileValidationResult> {
  const fileError = validateVideoFile(file);
  if (fileError) {
    return { ok: false, errorKey: fileError };
  }
  const metadata = await extractVideoMetadata(file as File);
  const metadataError = validateVideoMetadata(metadata);
  if (metadataError) {
    return { ok: false, errorKey: metadataError };
  }
  return { ok: true, metadata };
}

export type ImageFileValidationResult =
  | { ok: true }
  | { ok: false; errorKey: ImageFileErrorKey };

export function validateImageFileFull(file: File | null): ImageFileValidationResult {
  const errorKey = validateImageFile(file);
  return errorKey ? { ok: false, errorKey } : { ok: true };
}

export type CaptionFileValidationResult =
  | { ok: true }
  | { ok: false; errorKey: CaptionFileErrorKey };

export function validateCaptionFileFull(file: File | null): CaptionFileValidationResult {
  const errorKey = validateCaptionFile(file);
  return errorKey ? { ok: false, errorKey } : { ok: true };
}
