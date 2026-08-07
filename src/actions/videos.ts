"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import { validationState, type FormState } from "@/actions/form-state";
import { VIDEO_LANGUAGE_CODES, VIDEO_PUBLICATION_STATUSES, VIDEO_VISIBILITIES } from "@/config/video";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  VIDEO_BUCKET_PRIVATE,
  VIDEO_THUMBNAILS_BUCKET,
} from "@/config/uploads";
import {
  createImageObjectPathForKind,
  createVideoObjectPath,
  isSafeStoragePath,
} from "@/lib/video/file-names";
import { getBucketForVisibility, getVisibilityClass } from "@/videos/visibility";
import { createVideoSchema } from "@/validations/video";

type CreateVideoUploadInput = {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  visibility: string;
  originalLanguage: string;
};

function createCreateVideoUploadSchema() {
  return z.object({
    originalFilename: z.string().min(1).max(255),
    mimeType: z.string().regex(/^video\//),
    sizeBytes: z.number().int().positive().max(MAX_VIDEO_UPLOAD_BYTES),
    durationSeconds: z
      .number()
      .finite()
      .nonnegative()
      .nullable()
      .optional()
      .transform((value) => (value == null ? null : Math.round(value))),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    visibility: z.enum(VIDEO_VISIBILITIES),
    originalLanguage: z.enum(VIDEO_LANGUAGE_CODES),
  });
}

export type CreateVideoUploadResult =
  | { status: "success"; videoId: string; storageBucket: string; storagePath: string }
  | { status: "error"; message: string };

function titleFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  const title = base || "Vídeo";
  return title.length >= 2 ? title.slice(0, 120) : `Vídeo ${title}`;
}

export async function createVideoUploadAction(
  input: CreateVideoUploadInput,
): Promise<CreateVideoUploadResult> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("actions.video");

  const parsed = createCreateVideoUploadSchema().safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: t("validationGeneral") };
  }

  const storageBucket = getBucketForVisibility(parsed.data.visibility);
  if (!storageBucket) {
    return { status: "error", message: t("validationGeneral") };
  }

  const videoId = randomUUID();
  const storagePath = createVideoObjectPath(
    user.id,
    videoId,
    parsed.data.originalFilename,
    randomUUID(),
  );
  if (!isSafeStoragePath(storagePath)) {
    return { status: "error", message: t("saveFailed") };
  }

  const { error } = await supabase.from("videos").insert({
    id: videoId,
    owner_id: user.id,
    storage_bucket: storageBucket,
    storage_path: storagePath,
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

  return { status: "success", videoId, storageBucket, storagePath };
}

export async function completeVideoUploadAction(videoId: string): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("actions.video");

  if (!isUuid(videoId)) {
    return { status: "error", message: t("invalidPublication") };
  }

  const video = await getOwnVideo(supabase, user.id, videoId);
  if (!video.data) {
    return { status: "error", message: t("notFound") };
  }

  if (video.data.processing_status !== "uploading") {
    return { status: "error", message: t("saveFailed") };
  }

  const { error: infoError } = await supabase.storage
    .from(video.data.storage_bucket)
    .info(video.data.storage_path);

  if (infoError) {
    return { status: "error", message: t("uploadNotFound") };
  }

  const { error: updateError } = await supabase
    .from("videos")
    .update({ processing_status: "uploaded" })
    .eq("id", videoId);

  if (updateError) {
    return { status: "error", message: t("saveFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("draftSaved") };
}

export async function cancelVideoUploadAction(videoId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!isUuid(videoId)) {
    return;
  }

  const video = await getOwnVideo(supabase, user.id, videoId);
  if (!video.data || video.data.processing_status !== "uploading") {
    return;
  }

  await supabase.from("videos").delete().eq("id", video.data.id);
  await supabase.storage.from(video.data.storage_bucket).remove([video.data.storage_path]);

  revalidatePath("/", "layout");
}

function isUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && z.string().uuid().safeParse(value).success;
}

async function getOwnVideo(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  videoId: string,
) {
  return supabase
    .from("videos")
    .select("id, status, processing_status, moderation_status, storage_bucket, storage_path, visibility")
    .eq("id", videoId)
    .eq("owner_id", userId)
    .maybeSingle();
}

const VIDEO_IMAGE_KINDS = ["thumbnail", "poster"] as const;
type VideoImageKind = (typeof VIDEO_IMAGE_KINDS)[number];

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const IMAGE_SAFE_EXTENSIONS = [".png", ".jpg", ".webp"] as const;

function getImageBucketForClass(visibility: string): string | null {
  const visibilityClass = getVisibilityClass(visibility);
  if (visibilityClass === "public") {
    return VIDEO_THUMBNAILS_BUCKET;
  }
  if (visibilityClass === "protected") {
    return VIDEO_BUCKET_PRIVATE;
  }
  return null;
}

export type PrepareVideoImageUploadResult =
  | { status: "success"; storageBucket: string; storagePath: string }
  | { status: "error"; message: string };

export async function prepareVideoImageUploadAction(
  videoId: string,
  kind: VideoImageKind,
  input: { filename: string; mimeType: string; sizeBytes: number },
): Promise<PrepareVideoImageUploadResult> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("actions.video");

  if (!isUuid(videoId) || !VIDEO_IMAGE_KINDS.includes(kind)) {
    return { status: "error", message: t("invalidPublication") };
  }

  const parsed = z
    .object({
      filename: z.string().min(1).max(255),
      mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
      sizeBytes: z.number().int().positive().max(MAX_IMAGE_UPLOAD_BYTES),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: t("validationGeneral") };
  }

  const video = await getOwnVideo(supabase, user.id, videoId);
  if (!video.data) {
    return { status: "error", message: t("notFound") };
  }

  const storageBucket = getImageBucketForClass(video.data.visibility);
  if (!storageBucket) {
    return { status: "error", message: t("validationGeneral") };
  }

  const extension = IMAGE_EXTENSION_BY_MIME[parsed.data.mimeType];
  const storagePath = createImageObjectPathForKind(user.id, videoId, kind, extension);
  if (!isSafeStoragePath(storagePath)) {
    return { status: "error", message: t("saveFailed") };
  }

  return { status: "success", storageBucket, storagePath };
}

type VideoImageRefInput = { storageBucket: string; storagePath: string } | null;

export async function saveVideoImagesAction(
  videoId: string,
  images: { thumbnail?: VideoImageRefInput; poster?: VideoImageRefInput },
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("actions.video");

  if (!isUuid(videoId)) {
    return { status: "error", message: t("invalidPublication") };
  }

  const video = await getOwnVideo(supabase, user.id, videoId);
  if (!video.data) {
    return { status: "error", message: t("notFound") };
  }
  const videoRow = video.data;

  const expectedBucket = getImageBucketForClass(videoRow.visibility);
  if (!expectedBucket) {
    return { status: "error", message: t("validationGeneral") };
  }

  async function resolveRef(
    ref: VideoImageRefInput,
    kind: VideoImageKind,
  ): Promise<{ bucket: string | null; path: string | null } | null> {
    if (!ref) {
      return null;
    }
    if (ref.storageBucket !== expectedBucket) {
      return null;
    }
    const prefix = `${user.id}/${videoRow.id}/${kind}/`;
    if (!ref.storagePath.startsWith(prefix)) {
      return null;
    }
    const fileName = ref.storagePath.slice(prefix.length);
    if (!IMAGE_SAFE_EXTENSIONS.some((ext) => fileName === `${kind}${ext}`)) {
      return null;
    }
    if (!isSafeStoragePath(ref.storagePath)) {
      return null;
    }
    const { error } = await supabase.storage.from(ref.storageBucket).info(ref.storagePath);
    if (error) {
      return null;
    }
    return { bucket: ref.storageBucket, path: ref.storagePath };
  }

  const [thumbnail, poster] = await Promise.all([
    resolveRef(images.thumbnail ?? null, "thumbnail"),
    resolveRef(images.poster ?? null, "poster"),
  ]);
  if (images.thumbnail && !thumbnail) {
    return { status: "error", message: t("imageSaveFailed") };
  }
  if (images.poster && !poster) {
    return { status: "error", message: t("imageSaveFailed") };
  }

  const { error } = await supabase
    .from("videos")
    .update({
      thumbnail_bucket: thumbnail?.bucket ?? null,
      thumbnail_path: thumbnail?.path ?? null,
      poster_bucket: poster?.bucket ?? null,
      poster_path: poster?.path ?? null,
    })
    .eq("id", videoId);

  if (error) {
    return { status: "error", message: t("imageSaveFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("imageSaved") };
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

  if (intent === "publish" && video.data.moderation_status !== "approved") {
    return { status: "error", message: ta("cannotPublishUnapproved") };
  }

  const targetBucket = getBucketForVisibility(parsed.data.visibility);
  if (targetBucket !== video.data.storage_bucket) {
    return { status: "error", message: ta("visibilityClassMismatch") };
  }

  const isPublishing = intent === "publish";

  if (isPublishing) {
    const { error: infoError } = await supabase.storage
      .from(video.data.storage_bucket)
      .info(video.data.storage_path);
    if (infoError) {
      return { status: "error", message: ta("uploadNotFound") };
    }
  }

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

  const videoId = formData.get("video_id");
  const parsed = z.enum(VIDEO_PUBLICATION_STATUSES).safeParse(formData.get("status"));
  if (typeof videoId !== "string" || !parsed.success) {
    return;
  }

  const video = await getOwnVideo(supabase, user.id, videoId);
  if (!video.data) {
    return;
  }

  if (parsed.data === "published") {
    if (video.data.moderation_status !== "approved") {
      return;
    }
    const { error: infoError } = await supabase.storage
      .from(video.data.storage_bucket)
      .info(video.data.storage_path);
    if (infoError) {
      return;
    }
    const { error } = await supabase
      .from("videos")
      .update({ status: "published", processing_status: "ready" })
      .eq("id", videoId);
    if (error) {
      return;
    }
  } else {
    const { error } = await supabase
      .from("videos")
      .update({ status: parsed.data })
      .eq("id", videoId);
    if (error) {
      return;
    }
  }

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
      "storage_bucket, storage_path, thumbnail_path, thumbnail_bucket, poster_path, poster_bucket, captions_path",
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
  if (video.captions_path) {
    cleanup.push({ bucket: video.storage_bucket, path: video.captions_path });
  }

  for (const { bucket, path } of cleanup) {
    await supabase.storage.from(bucket).remove([path]);
  }

  revalidatePath("/", "layout");
}
