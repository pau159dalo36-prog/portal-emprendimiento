import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_DIMENSION,
  isAllowedAvatarMime,
} from "@/profiles/avatar";

export function validateAvatarFile(file: File): string | null {
  if (!isAllowedAvatarMime(file.type)) {
    return "Formato no permitido. Usa PNG, JPEG, WebP, GIF o AVIF.";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return "La imagen no puede superar los 5 MB.";
  }
  return null;
}

async function drawToWebp(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  } finally {
    bitmap.close();
  }
}

export async function compressAvatar(file: File): Promise<File> {
  try {
    const blob = await drawToWebp(file);
    if (blob && blob.size > 0 && blob.size < file.size) {
      return new File([blob], "avatar.webp", { type: "image/webp" });
    }
  } catch {
    // Si la compresión falla (ej. formatos animados), se usa el archivo original.
  }
  return file;
}
