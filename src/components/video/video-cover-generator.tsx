"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Loader2, Wand2 } from "lucide-react";

import {
  prepareVideoImageUploadAction,
  saveVideoImagesAction,
} from "@/actions/videos";
import { Button } from "@/components/ui/button";
import {
  captureVideoFrame,
  loadVideoElement,
  seekVideoTo,
  type VideoFrameResult,
} from "@/lib/video/frame";
import { uploadFileToStorage } from "@/lib/video/upload";
import { createClient } from "@/lib/supabase/client";
import { formatPlaybackTime } from "@/lib/video/utils";
import { useRouter } from "@/i18n/navigation";

type VideoCoverGeneratorProps = {
  videoId: string;
  videoSrc: string | null;
};

type CoverStatus = "idle" | "loading" | "preview" | "error";

export function VideoCoverGenerator({ videoId, videoSrc }: VideoCoverGeneratorProps) {
  const t = useTranslations("videoForm");
  const router = useRouter();

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const pendingFrameRef = useRef<VideoFrameResult | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<CoverStatus>(videoSrc ? "loading" : "error");
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      videoElementRef.current = null;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!videoSrc || status !== "loading") {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const video = await loadVideoElement(videoSrc);
        if (cancelled || !mountedRef.current) {
          return;
        }
        videoElementRef.current = video;
        const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
        setDuration(nextDuration);
        if (nextDuration > 0) {
          await seekVideoTo(video, 0);
        }
        if (mountedRef.current) {
          setStatus("idle");
        }
      } catch {
        if (mountedRef.current) {
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoSrc, status]);

  async function generate() {
    if (saving) {
      return;
    }
    let video = videoElementRef.current;
    if (!video) {
      if (!videoSrc) {
        setStatus("error");
        return;
      }
      try {
        setStatus("loading");
        video = await loadVideoElement(videoSrc);
        videoElementRef.current = video;
      } catch {
        setStatus("error");
        return;
      }
    }

    try {
      await seekVideoTo(video, time);
      const frame = await captureVideoFrame(video);
      const url = URL.createObjectURL(frame.blob);
      if (previewUrlRef.current && previewUrlRef.current !== url) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewUrlRef.current = url;
      setPreviewUrl(url);
      pendingFrameRef.current = frame;
      setError(null);
      setStatus("preview");
    } catch {
      setStatus("error");
      setError(t("coverError"));
    }
  }

  async function save() {
    const frame = pendingFrameRef.current;
    if (!frame || saving) {
      return;
    }
    setSaving(true);
    setError(null);

    const posterFile = new File([frame.blob], `poster${frame.extension}`, {
      type: frame.mimeType,
    });

    const prepared = await prepareVideoImageUploadAction(videoId, "poster", {
      filename: posterFile.name,
      mimeType: posterFile.type,
      sizeBytes: posterFile.size,
    });
    if (prepared.status === "error") {
      setError(prepared.message);
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError(t("errors.authRequired"));
      setSaving(false);
      return;
    }

    const uploaded = await uploadFileToStorage({
      bucket: prepared.storageBucket,
      path: prepared.storagePath,
      file: posterFile,
      accessToken,
      upsert: true,
    });
    if (!uploaded.ok) {
      setError(t("coverError"));
      setSaving(false);
      return;
    }

    const saved = await saveVideoImagesAction(videoId, {
      poster: {
        storageBucket: prepared.storageBucket,
        storagePath: prepared.storagePath,
      },
    });

    if (saved.status === "success") {
      pendingFrameRef.current = null;
      setStatus("idle");
      setSaving(false);
      router.refresh();
    } else {
      setError(saved.message ?? t("coverError"));
      setSaving(false);
    }
  }

  const canGenerate = status === "idle" || status === "preview";
  const rangeMax = duration > 0 ? duration : 1;

  return (
    <div className="grid gap-4">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{t("coverTitle")}</span>
        <span className="text-xs text-muted-foreground">{t("coverHint")}</span>
      </div>

      {!videoSrc ? (
        <p className="text-sm text-muted-foreground">{t("coverUnavailable")}</p>
      ) : (
        <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/40 p-4">
          {status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
              {t("coverLoading")}
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-destructive">{error ?? t("coverError")}</p>
          )}

          {canGenerate && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="shrink-0 text-sm">{t("coverTimeLabel")}</span>
                  <input
                    type="range"
                    min={0}
                    max={rangeMax}
                    step={0.5}
                    value={time}
                    disabled={duration <= 0}
                    onChange={(event) => setTime(Number(event.target.value))}
                    className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed"
                  />
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatPlaybackTime(time)}
                  </span>
                </label>
                <Button type="button" variant="outline" size="sm" onClick={() => void generate()}>
                  <Wand2 aria-hidden="true" />
                  {status === "preview" ? t("coverRegenerate") : t("coverGenerate")}
                </Button>
              </div>

              {status === "preview" && previewUrl && (
                <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-black sm:w-56">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt={t("coverPreview")} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex items-start gap-2">
                    <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
                      {saving ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        <Camera aria-hidden="true" />
                      )}
                      {saving ? t("coverSaving") : t("coverSave")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
