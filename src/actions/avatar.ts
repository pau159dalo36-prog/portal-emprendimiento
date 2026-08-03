"use server";

import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("actions.avatar");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: t("noFile") };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { status: "error", message: t("tooLarge") };
  }
  if (!isAllowedAvatarMime(file.type)) {
    return {
      status: "error",
      message: t("badFormat"),
    };
  }

  const buffer = await file.arrayBuffer();
  if (!isImageSignature(buffer)) {
    return { status: "error", message: t("notImage") };
  }

  const path = avatarStoragePath(user.id);
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return { status: "error", message: t("uploadFailed") };
  }

  await removeFilesInFolder(supabase, user.id, path);

  const avatarUrl = getPublicAvatarUrl(getSupabaseUrl(), path);
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (profileError) {
    return { status: "error", message: t("profileUpdateFailed") };
  }

  return { status: "success", message: t("uploaded") };
}

export async function removeAvatarAction(): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("actions.avatar");

  await removeFilesInFolder(supabase, user.id);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: t("removeFailed") };
  }

  return { status: "success", message: t("removed") };
}
