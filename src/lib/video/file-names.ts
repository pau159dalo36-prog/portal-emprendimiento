import { generateImageObjectPath, generateVideoObjectPath, normalizeFilename } from "@/lib/video/utils";

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function uniqueName(originalFilename: string, uniqueToken: string, fallback: string): string {
  const normalized = normalizeFilename(originalFilename);
  const dotIndex = normalized.lastIndexOf(".");
  const extension = dotIndex >= 0 ? normalized.slice(dotIndex) : "";
  const baseName = dotIndex >= 0 ? normalized.slice(0, dotIndex) : normalized;
  const stem = (baseName || fallback).replace(/-+$/g, "");
  return `${stem}-${uniqueToken}${extension}`;
}

export function createVideoObjectPath(
  userId: string,
  videoId: string,
  originalFilename: string,
  uniqueToken: string,
): string {
  return generateVideoObjectPath(userId, videoId, uniqueName(originalFilename, uniqueToken, "video"));
}

export function createImageObjectPath(
  userId: string,
  videoId: string,
  kind: "thumbnail" | "poster",
  originalFilename: string,
  uniqueToken: string,
): string {
  return generateImageObjectPath(
    userId,
    videoId,
    kind,
    uniqueName(originalFilename, uniqueToken, kind),
  );
}

const SAFE_EXTENSION = /^\.[a-zA-Z0-9]+$/;

export function createImageObjectPathForKind(
  userId: string,
  videoId: string,
  kind: "thumbnail" | "poster",
  extension: string,
): string {
  const safeExt = extension && SAFE_EXTENSION.test(extension) ? extension.toLowerCase() : "";
  return generateImageObjectPath(userId, videoId, kind, `${kind}${safeExt}`);
}

export function isSafeStoragePath(path: string): boolean {
  if (!path || path.length > 500) {
    return false;
  }
  if (path.startsWith("/") || path.endsWith("/") || path.includes("\\") || path.includes("..")) {
    return false;
  }
  return path.split("/").every((segment) => segment.length > 0 && SAFE_SEGMENT.test(segment));
}
