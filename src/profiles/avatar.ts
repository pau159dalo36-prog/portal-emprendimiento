export const AVATAR_FILE_NAME = "avatar.webp";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_DIMENSION = 512;
export const AVATAR_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

export function isAllowedAvatarMime(mime: string): mime is AvatarMimeType {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(mime);
}

export function avatarStorageFolder(userId: string): string {
  return `${userId}`;
}

export function avatarStoragePath(userId: string): string {
  return `${avatarStorageFolder(userId)}/${AVATAR_FILE_NAME}`;
}

export function getPublicAvatarUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;
}

export function isImageSignature(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  const view = new DataView(bytes.buffer);

  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return true; // PNG
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true; // JPEG
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return true; // GIF87a/GIF89a
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true; // WEBP (RIFF....WEBP)
  }
  if (bytes.length >= 12 && view.getUint32(4, false) === 0x66747970) {
    const brand1 = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    const brand2 = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0);
    return brand1 === "avif" || brand1 === "avis" || brand2 === "avif" || brand2 === "avis";
  }
  return false;
}
