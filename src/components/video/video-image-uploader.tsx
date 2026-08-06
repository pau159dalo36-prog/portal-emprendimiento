"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

import {
  prepareVideoImageUploadAction,
  saveVideoImagesAction,
} from "@/actions/videos";
import { validateImageFileFull } from "@/lib/video/file-validation";
import { normalizeMime } from "@/lib/video/validation";
import { uploadFileToStorage, type UploadProgress } from "@/lib/video/upload";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

type VideoImageKind = "thumbnail" | "poster";

type VideoImageUploaderProps = {
  videoId: string;
  thumbnailSrc: string | null;
  posterSrc: string | null;
};

type ImageSlot = {
  phase: "idle" | "uploading" | "saving";
  progress: UploadProgress | null;
  error: string | null;
};

const EMPTY_SLOT: ImageSlot = { phase: "idle", progress: null, error: null };

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoImageUploader({ videoId, thumbnailSrc, posterSrc }: VideoImageUploaderProps) {
  const t = useTranslations("videoForm");
  const tv = useTranslations("videoValidation");
  const router = useRouter();

  const [slots, setSlots] = useState<Record<VideoImageKind, ImageSlot>>({
    thumbnail: EMPTY_SLOT,
    poster: EMPTY_SLOT,
  });
  const inputRef = useRef<Record<VideoImageKind, HTMLInputElement | null>>({
    thumbnail: null,
    poster: null,
  });

  function setSlot(kind: VideoImageKind, patch: Partial<ImageSlot>) {
    setSlots((current) => ({ ...current, [kind]: { ...current[kind], ...patch } }));
  }

  async function handlePickFile(kind: VideoImageKind, file: File | null) {
    if (!file || slots[kind].phase !== "idle") {
      return;
    }
    setSlot(kind, { error: null });

    const result = validateImageFileFull(file);
    if (!result.ok) {
      setSlot(kind, { error: tv(result.errorKey) });
      return;
    }

    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setSlot(kind, { error: t("errors.authRequired") });
      return;
    }

    const prepared = await prepareVideoImageUploadAction(videoId, kind, {
      filename: file.name,
      mimeType: normalizeMime(file.type, file.name),
      sizeBytes: file.size,
    });
    if (prepared.status === "error") {
      setSlot(kind, { error: prepared.message });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setSlot(kind, { error: t("errors.authRequired") });
      return;
    }

    const controller = new AbortController();
    setSlot(kind, { phase: "uploading", progress: null });

    const uploaded = await uploadFileToStorage({
      bucket: prepared.storageBucket,
      path: prepared.storagePath,
      file,
      accessToken,
      upsert: true,
      signal: controller.signal,
      onProgress: (progress) => setSlot(kind, { progress }),
    });

    if (!uploaded.ok) {
      setSlot(kind, { phase: "idle", error: tv("uploadFailed") });
      return;
    }

    setSlot(kind, { phase: "saving" });
    const saved = await saveVideoImagesAction(videoId, {
      [kind]: { storageBucket: prepared.storageBucket, storagePath: prepared.storagePath },
    });
    setSlot(kind, { phase: "idle", error: saved.status === "success" ? null : saved.message });

    if (saved.status === "success") {
      router.refresh();
    }
  }

  async function handleRemove(kind: VideoImageKind) {
    if (slots[kind].phase !== "idle") {
      return;
    }
    const saved = await saveVideoImagesAction(videoId, { [kind]: null });
    if (saved.status === "success") {
      router.refresh();
    } else {
      setSlot(kind, { error: saved.message });
    }
  }

  function renderSlot(kind: VideoImageKind, src: string | null) {
    const slot = slots[kind];
    const isBusy = slot.phase !== "idle";
    const label = t(`${kind}Label`);
    const hint = t(`${kind}Hint`);

    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </div>
          <input
            ref={(node) => {
              inputRef.current[kind] = node;
            }}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              event.target.value = "";
              void handlePickFile(kind, next);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => inputRef.current[kind]?.click()}
          >
            {src ? <Upload aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}
            {t(src ? "imageReplace" : "imageUpload")}
          </Button>
        </div>

        {src && (
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/60 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            {isBusy && (
              <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]">
                <div className="grid gap-1 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    {slot.phase === "uploading" ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                        <span>{t("imageUploading")}</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                        <span>{t("uploadVerifying")}</span>
                      </>
                    )}
                  </div>
                  {slot.phase === "uploading" && slot.progress && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width]"
                          style={{ width: `${slot.progress.percent}%` }}
                        />
                      </div>
                      <span className="shrink-0">{formatFileSize(slot.progress.loaded)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {src && !isBusy && (
          <Button type="button" variant="ghost" size="sm" onClick={() => void handleRemove(kind)}>
            <Trash2 aria-hidden="true" />
            {t("imageRemove")}
          </Button>
        )}

        {slot.error && <p className="text-sm text-destructive">{slot.error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {renderSlot("thumbnail", thumbnailSrc)}
      {renderSlot("poster", posterSrc)}
    </div>
  );
}
