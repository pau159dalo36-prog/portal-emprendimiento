"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileVideo, Loader2 } from "lucide-react";

import { saveVideoDraftAction } from "@/actions/videos";
import { languageFromLocale, getVisibilityLabel, VIDEO_VISIBILITIES, type VideoVisibility } from "@/config/video";
import { MAX_VIDEO_UPLOAD_BYTES } from "@/config/uploads";
import { createSupabaseVideoProvider } from "@/lib/video/supabase-video-provider";
import {
  EXTRACTABLE_VIDEO_MIME_TYPES,
  normalizeMime,
  validateVideoFile,
  validateVideoMetadata,
  type VideoMetadataInput,
} from "@/lib/video/validation";
import { generateVideoObjectPath } from "@/lib/video/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { VideoUploadDropzone } from "@/components/ui/video-upload-dropzone";

async function extractVideoMetadata(file: File): Promise<VideoMetadataInput> {
  const mime = normalizeMime(file.type, file.name);
  if (!(EXTRACTABLE_VIDEO_MIME_TYPES as readonly string[]).includes(mime)) {
    return { durationSeconds: null, width: null, height: null };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (metadata: VideoMetadataInput) => {
      URL.revokeObjectURL(objectUrl);
      resolve(metadata);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () =>
      done({
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
    video.onerror = () => done({ durationSeconds: null, width: null, height: null });
    video.src = objectUrl;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoUploadForm() {
  const t = useTranslations("videoForm");
  const tv = useTranslations("videoValidation");
  const locale = useLocale();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<VideoVisibility>("public");
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const metadataRef = useRef<VideoMetadataInput>({ durationSeconds: null, width: null, height: null });

  function handleFile(next: File) {
    const errorKey = validateVideoFile(next);
    if (errorKey) {
      setFile(null);
      setFileError(tv(errorKey));
      return;
    }
    setFile(next);
    setFileError(null);
    setFormError(null);
    void extractVideoMetadata(next).then((metadata) => {
      metadataRef.current = metadata;
      const metadataError = validateVideoMetadata(metadata);
      if (metadataError) {
        setFile(null);
        setFileError(tv(metadataError));
      }
    });
  }

  async function handleUpload() {
    if (!file || uploading) {
      return;
    }
    setUploading(true);
    setFormError(null);

    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setFormError(t("errors.authRequired"));
      setUploading(false);
      return;
    }

    const videoId = crypto.randomUUID();
    const storagePath = generateVideoObjectPath(authData.user.id, videoId, file.name);
    const provider = createSupabaseVideoProvider(supabase);
    const storageBucket = provider.chooseVideoBucket(visibility);

    const { error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(storagePath, file, { contentType: file.type, cacheControl: "3600" });

    if (uploadError) {
      setFormError(tv("uploadFailed"));
      setUploading(false);
      return;
    }

    const metadata = metadataRef.current;
    const result = await saveVideoDraftAction({
      videoId,
      storageBucket,
      storagePath,
      originalFilename: file.name,
      mimeType: normalizeMime(file.type, file.name),
      sizeBytes: file.size,
      durationSeconds: metadata.durationSeconds ?? null,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      visibility,
      originalLanguage: languageFromLocale(locale),
    });

    if (result.status === "success") {
      router.push(`/videos/${videoId}/editar`);
      return;
    }

    setFormError(result.message ?? tv("uploadFailed"));
    setUploading(false);
  }

  return (
    <div className="grid gap-5">
      <VideoUploadDropzone
        accept="video/mp4,video/webm"
        maxBytes={MAX_VIDEO_UPLOAD_BYTES}
        disabled={uploading}
        onFile={handleFile}
      />

      {file && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <FileVideo className="size-6 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
        </div>
      )}

      {fileError && <p className="text-sm text-destructive">{fileError}</p>}

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{t("visibilityLabel")}</span>
        <select
          value={visibility}
          disabled={uploading}
          onChange={(event) => setVisibility(event.target.value as VideoVisibility)}
          className="flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 dark:bg-input/30 dark:border-input/60"
        >
          {VIDEO_VISIBILITIES.map((value) => (
            <option key={value} value={value}>
              {t(`visibility.${getVisibilityLabel(value)}`)}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">{t("visibilityHint")}</span>
      </label>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <Button type="button" size="lg" disabled={!file || uploading} onClick={handleUpload}>
        {uploading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            {t("uploadPending")}
          </>
        ) : (
          t("uploadSubmit")
        )}
      </Button>
    </div>
  );
}
