export function normalizeFilename(filename: string): string {
  const cleaned = filename
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return cleaned || "video";
}

export function generateVideoObjectPath(userId: string, videoId: string, filename: string): string {
  return `${userId}/${videoId}/${normalizeFilename(filename)}`;
}

export function generateImageObjectPath(
  userId: string,
  videoId: string,
  kind: "thumbnail" | "poster",
  filename: string,
): string {
  return `${userId}/${videoId}/${kind}/${normalizeFilename(filename)}`;
}

export function getPublicObjectUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function getVideoImageUrl(
  supabaseUrl: string,
  bucket: string | null,
  path: string | null,
): string | null {
  if (!path || !bucket) {
    return null;
  }
  return getPublicObjectUrl(supabaseUrl, bucket, path);
}

export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return "";
  }
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(remaining)}` : `${minutes}:${pad(remaining)}`;
}

export function formatPlaybackTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(remaining)}`;
  }
  return `${minutes}:${pad(remaining)}`;
}
