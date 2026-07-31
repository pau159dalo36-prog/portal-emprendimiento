"use server";

import { requireUser } from "@/auth/session";
import { getSupabaseUrl } from "@/lib/env";
import {
  AVATAR_MAX_BYTES,
  avatarStorageFolder,
  avatarStoragePath,
  getPublicAvatarUrl,
  isAllowedAvatarMime,
  isImageSignature,
} from "@/profiles/avatar";
import type { FormState } from "@/actions/form-state";

async function removeFilesInFolder(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  exceptPath?: string,
): Promise<void> {
  const { data: files } = await supabase.storage.from("avatars").list(avatarStorageFolder(userId));
  const paths = (files ?? [])
    .map((file) => `${avatarStorageFolder(userId)}/${file.name}`)
    .filter((path) => path !== exceptPath);

  if (paths.length > 0) {
    await supabase.storage.from("avatars").remove(paths);
  }
}

export async function updateAvatarAction(formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecciona una imagen de perfil." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { status: "error", message: "La imagen no puede superar los 5 MB." };
  }
  if (!isAllowedAvatarMime(file.type)) {
    return {
      status: "error",
      message: "Formato no permitido. Usa PNG, JPEG, WebP, GIF o AVIF.",
    };
  }

  const buffer = await file.arrayBuffer();
  if (!isImageSignature(buffer)) {
    return { status: "error", message: "El archivo no es una imagen válida." };
  }

  const path = avatarStoragePath(user.id);
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return { status: "error", message: "No se pudo subir la imagen. Inténtalo de nuevo." };
  }

  await removeFilesInFolder(supabase, user.id, path);

  const avatarUrl = getPublicAvatarUrl(getSupabaseUrl(), path);
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (profileError) {
    return { status: "error", message: "La imagen se subió pero no se pudo actualizar el perfil." };
  }

  return { status: "success", message: "Avatar actualizado." };
}

export async function removeAvatarAction(): Promise<FormState> {
  const { supabase, user } = await requireUser();

  await removeFilesInFolder(supabase, user.id);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: "No se pudo quitar el avatar. Inténtalo de nuevo." };
  }

  return { status: "success", message: "Avatar eliminado." };
}
