"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import { validationState, type FormState } from "@/actions/form-state";
import { VIDEO_LANGUAGE_CODES, VIDEO_PUBLICATION_STATUSES, VIDEO_VISIBILITIES } from "@/config/video";
import { getBucketForVisibility } from "@/videos/visibility";
import { createVideoSchema } from "@/validations/video";
import type { Database } from "@/types/database.types";

type VideoUpdate = Database["public"]["Tables"]["videos"]["Update"];

type SaveVideoDraftInput = {
  videoId: string;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  visibility: string;
  originalLanguage: string;
};

function createSaveVideoDraftSchema() {
  return z.object({
    videoId: z.string().uuid(),
    storageBucket: z.string().min(1).max(100),
    storagePath: z.string().min(1).max(500),
    originalFilename: z.string().min(1).max(255),
    mimeType: z.string().regex(/^video\//),
    sizeBytes: z.number().int().nonnegative(),
    durationSeconds: z.number().int().nonnegative().nullable().optional(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    visibility: z.enum(VIDEO_VISIBILITIES),
    originalLanguage: z.enum(VIDEO_LANGUAGE_CODES),
  });
}

function titleFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  const title = base || "Vídeo";
  return title.length >= 2 ? title.slice(0, 120) : `Vídeo ${title}`;
}

export async function saveVideoDraftAction(input: SaveVideoDraftInput): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("actions.video");

  const parsed = createSaveVideoDraftSchema().safeParse(input);
  if (!parsed.success) {
    return validationState(parsed.error, t("validationGeneral"));
  }

  const expectedBucket = getBucketForVisibility(parsed.data.visibility);
  if (expectedBucket !== parsed.data.storageBucket) {
    return { status: "error", message: t("visibilityClassMismatch") };
  }

  const { error } = await supabase.from("videos").insert({
    id: parsed.data.videoId,
    owner_id: user.id,
    storage_bucket: parsed.data.storageBucket,
    storage_path: parsed.data.storagePath,
    original_filename: parsed.data.originalFilename,
    mime_type: parsed.data.mimeType,
    size_bytes: parsed.data.sizeBytes,
    duration_seconds: parsed.data.durationSeconds ?? null,
    width: parsed.data.width ?? null,
    height: parsed.data.height ?? null,
    visibility: parsed.data.visibility,
    original_language: parsed.data.originalLanguage,
    title: titleFromFilename(parsed.data.originalFilename),
    processing_status: "uploading",
    moderation_status: "pending",
    status: "draft",
  });

  if (error) {
    return { status: "error", message: t("saveFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("draftSaved") };
}

function isUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && z.string().uuid().safeParse(value).success;
}

async function getOwnVideo(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, videoId: string) {
  return supabase
    .from("videos")
    .select("id, processing_status, storage_bucket, visibility")
    .eq("id", videoId)
    .eq("owner_id", userId)
    .maybeSingle();
}

function parseVideoFields(tv: Awaited<ReturnType<typeof getTranslations>>, formData: FormData) {
  return createVideoSchema(tv).safeParse({
    title: formData.get("title"),
    caption: formData.get("caption"),
    original_language: formData.get("original_language"),
    visibility: formData.get("visibility"),
    project_id: formData.get("project_id"),
  });
}

export type VideoSaveIntent = "save" | "publish";

export async function saveVideoPublicationAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const tv = await getTranslations("validation");
  const ta = await getTranslations("actions.video");

  const videoId = formData.get("video_id");
  if (!isUuid(videoId)) {
    return { status: "error", message: ta("invalidPublication") };
  }

  const intent = formData.get("intent");
  if (intent !== "save" && intent !== "publish") {
    return { status: "error", message: ta("invalidIntent") };
  }

  const parsed = parseVideoFields(tv, formData);
  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const video = await getOwnVideo(supabase, user.id, videoId);
  if (!video.data) {
    return { status: "error", message: ta("notFound") };
  }

  if (intent === "publish" && video.data.processing_status === "failed") {
    return { status: "error", message: ta("cannotPublishFailed") };
  }

  const targetBucket = getBucketForVisibility(parsed.data.visibility);
  if (targetBucket !== video.data.storage_bucket) {
    return { status: "error", message: ta("visibilityClassMismatch") };
  }

  const isPublishing = intent === "publish";

  const { error } = await supabase
    .from("videos")
    .update({
      title: parsed.data.title,
      caption: parsed.data.caption,
      original_language: parsed.data.original_language,
      visibility: parsed.data.visibility,
      project_id: parsed.data.project_id,
      ...(isPublishing ? { status: "published", processing_status: "ready" } : {}),
    })
    .eq("id", videoId);

  if (error) {
    return { status: "error", message: ta(isPublishing ? "publishFailed" : "updateFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: ta(isPublishing ? "published" : "saved") };
}

export async function changeVideoStatusAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("actions.video");

  const videoId = formData.get("video_id");
  const parsed = z.enum(VIDEO_PUBLICATION_STATUSES, { error: t("statusInvalid") }).safeParse(formData.get("status"));
  if (typeof videoId !== "string" || !parsed.success) {
    return;
  }

  const video = await getOwnVideo(supabase, user.id, videoId);
  if (!video.data) {
    return;
  }

  const updates: VideoUpdate = { status: parsed.data };
  if (parsed.data === "published") {
    updates.processing_status = "ready";
  }

  await supabase.from("videos").update(updates).eq("id", videoId);

  revalidatePath("/", "layout");
}

export async function deleteVideoAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const videoId = formData.get("video_id");
  if (typeof videoId !== "string" || !z.string().uuid().safeParse(videoId).success) {
    return;
  }

  const { data: video } = await supabase
    .from("videos")
    .select(
      "storage_bucket, storage_path, thumbnail_path, thumbnail_bucket, poster_path, poster_bucket",
    )
    .eq("id", videoId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!video) {
    return;
  }

  await supabase.from("videos").delete().eq("id", videoId);

  const cleanup: { bucket: string; path: string }[] = [
    { bucket: video.storage_bucket, path: video.storage_path },
  ];
  if (video.thumbnail_path && video.thumbnail_bucket) {
    cleanup.push({ bucket: video.thumbnail_bucket, path: video.thumbnail_path });
  }
  if (video.poster_path && video.poster_bucket) {
    cleanup.push({ bucket: video.poster_bucket, path: video.poster_path });
  }

  for (const { bucket, path } of cleanup) {
    await supabase.storage.from(bucket).remove([path]);
  }

  revalidatePath("/", "layout");
}
