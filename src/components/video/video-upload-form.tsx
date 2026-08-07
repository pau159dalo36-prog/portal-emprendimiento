"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileVideo, Loader2, RotateCcw, X } from "lucide-react";

import {
  cancelVideoUploadAction,
  completeVideoUploadAction,
  createVideoUploadAction,
  prepareVideoImageUploadAction,
  saveVideoImagesAction,
} from "@/actions/videos";
import { getVisibilityLabel, languageFromLocale, VIDEO_VISIBILITIES, type VideoVisibility } from "@/config/video";
import { MAX_VIDEO_UPLOAD_BYTES } from "@/config/uploads";
import { validateVideoFileFull } from "@/lib/video/file-validation";
import { normalizeMime, type VideoMetadataInput } from "@/lib/video/validation";
import { uploadFileToStorage, type UploadProgress } from "@/lib/video/upload";
import { extractVideoFrame } from "@/lib/video/frame";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { VideoUploadDropzone } from "@/components/ui/video-upload-dropzone";

type UploadPhase = "idle" | "preparing" | "uploading" | "verifying" | "failed";

type PendingDraft = {
  videoId: string;
  storageBucket: string;
  storagePath: string;
};

const BUSY_PHASES: readonly UploadPhase[] = ["preparing", "uploading", "verifying"];

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
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);

  const metadataRef = useRef<VideoMetadataInput>({
    durationSeconds: null,
    width: null,
    height: null,
  });
  const pendingDraftRef = useRef<PendingDraft | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isBusy = BUSY_PHASES.includes(phase);

  useEffect(() => {
    if (phase !== "uploading") {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  async function discardPendingDraft() {
    const pending = pendingDraftRef.current;
    if (pending) {
      await cancelVideoUploadAction(pending.videoId);
      pendingDraftRef.current = null;
    }
  }

  async function resetToIdle() {
    await discardPendingDraft();
    abortRef.current = null;
    setFile(null);
    setProgress(null);
    setFormError(null);
    setFileError(null);
    setPhase("idle");
  }

  async function handleFile(next: File) {
    if (isBusy) {
      return;
    }
    await discardPendingDraft();
    abortRef.current = null;
    setProgress(null);

    const result = await validateVideoFileFull(next);
    if (!result.ok) {
      setFile(null);
      setFileError(tv(result.errorKey));
      setPhase("idle");
      return;
    }
    metadataRef.current = result.metadata;
    setFile(next);
    setFileError(null);
    setFormError(null);
    setPhase("idle");
  }

  async function handleUpload() {
    if (!file || isBusy) {
      return;
    }
    setFormError(null);

    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setFormError(t("errors.authRequired"));
      return;
    }

    let draft = pendingDraftRef.current;
    if (!draft) {
      setPhase("preparing");
      const created = await createVideoUploadAction({
        originalFilename: file.name,
        mimeType: normalizeMime(file.type, file.name),
        sizeBytes: file.size,
        durationSeconds: metadataRef.current.durationSeconds,
        width: metadataRef.current.width,
        height: metadataRef.current.height,
        visibility,
        originalLanguage: languageFromLocale(locale),
      });

      if (created.status === "error") {
        setPhase("failed");
        setFormError(created.message);
        return;
      }

      draft = {
        videoId: created.videoId,
        storageBucket: created.storageBucket,
        storagePath: created.storagePath,
      };
      pendingDraftRef.current = draft;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setPhase("failed");
      setFormError(t("errors.authRequired"));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("uploading");

    const result = await uploadFileToStorage({
      bucket: draft.storageBucket,
      path: draft.storagePath,
      file,
      accessToken,
      signal: controller.signal,
      onProgress: setProgress,
    });

    if (!result.ok) {
      abortRef.current = null;
      if (result.error === "aborted") {
        await resetToIdle();
        setFormError(t("uploadCancelled"));
        return;
      }
      setPhase("failed");
      setFormError(tv("uploadFailed"));
      return;
    }

    setPhase("verifying");
    const completed = await completeVideoUploadAction(draft.videoId);
    abortRef.current = null;
    pendingDraftRef.current = null;

    if (completed.status === "success") {
      await generateAndSaveCover(draft.videoId);
      router.push(`/videos/${draft.videoId}/editar`);
      return;
    }

    setPhase("failed");
    setFormError(completed.message ?? tv("uploadFailed"));
  }

  async function generateAndSaveCover(videoId: string) {
    if (!file) {
      return;
    }
    setGeneratingCover(true);
    try {
      const frame = await extractVideoFrame(file);
      const posterFile = new File([frame.blob], `poster${frame.extension}`, {
        type: frame.mimeType,
      });

      const prepared = await prepareVideoImageUploadAction(videoId, "poster", {
        filename: posterFile.name,
        mimeType: posterFile.type,
        sizeBytes: posterFile.size,
      });
      if (prepared.status === "error") {
        return;
      }

      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        return;
      }

      const uploadResult = await uploadFileToStorage({
        bucket: prepared.storageBucket,
        path: prepared.storagePath,
        file: posterFile,
        accessToken,
        upsert: true,
      });
      if (!uploadResult.ok) {
        return;
      }

      await saveVideoImagesAction(videoId, {
        poster: {
          storageBucket: prepared.storageBucket,
          storagePath: prepared.storagePath,
        },
      });
    } catch {
      // La portada es opcional: si falla, continuamos al editor.
    } finally {
      setGeneratingCover(false);
    }
  }

  function handleCancel() {
    if (abortRef.current) {
      abortRef.current.abort();
      return;
    }
    void resetToIdle();
  }

  function handleRetry() {
    if (!file) {
      setPhase("idle");
      return;
    }
    void handleUpload();
  }

  return (
    <div className="grid gap-5">
      <VideoUploadDropzone
        accept="video/mp4,video/webm"
        maxBytes={MAX_VIDEO_UPLOAD_BYTES}
        disabled={isBusy}
        onFile={(nextFile) => void handleFile(nextFile)}
      />

      {file && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <FileVideo className="size-6 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          {!isBusy && (
            <button
              type="button"
              onClick={() => void resetToIdle()}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label={t("cancelUpload")}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {isBusy && (
        <div className="grid gap-2 rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            <span>
              {generatingCover
                ? t("generatingCover")
                : phase === "uploading"
                  ? progress
                    ? t("uploadPercent", { percent: progress.percent })
                    : t("uploadPending")
                  : t("uploadVerifying")}
            </span>
          </div>
          {phase === "uploading" && progress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="shrink-0">
                {t("uploadBytes", {
                  loaded: formatFileSize(progress.loaded),
                  total: formatFileSize(progress.total),
                })}
              </span>
            </div>
          )}
          {phase === "uploading" && (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                {t("cancelUpload")}
              </Button>
            </div>
          )}
        </div>
      )}

      {formError && <p className="text-sm text-destructive">{formError}</p>}
      {fileError && <p className="text-sm text-destructive">{fileError}</p>}

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{t("visibilityLabel")}</span>
        <select
          value={visibility}
          disabled={isBusy || phase === "failed"}
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

      {phase === "failed" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void resetToIdle()}>
            <X aria-hidden="true" />
            {t("cancelUpload")}
          </Button>
          <Button type="button" onClick={handleRetry}>
            <RotateCcw aria-hidden="true" />
            {t("retryUpload")}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          disabled={!file || isBusy}
          onClick={() => void handleUpload()}
        >
          {isBusy ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              {phase === "uploading" ? t("uploadPending") : t("uploadVerifying")}
            </>
          ) : (
            t("uploadSubmit")
          )}
        </Button>
      )}
    </div>
  );
}
