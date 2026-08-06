"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, Send } from "lucide-react";

import { saveVideoPublicationAction, type VideoSaveIntent } from "@/actions/videos";
import { initialFormState, type FormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getVisibilityLabel, VIDEO_LANGUAGES } from "@/config/video";
import { getClassForBucket, getVisibilitiesForClass } from "@/videos/visibility";
import { useRouter } from "@/i18n/navigation";
import {
  emptyVideoFormData,
  toVideoFormData,
  type VideoFormData,
} from "@/videos/map";
import type { VideoRow } from "@/videos/types";

export type VideoProjectOption = { id: string; name: string; slug: string };

type VideoPublicationFormProps = {
  videoId: string;
  video?: VideoRow | null;
  projects?: VideoProjectOption[];
};

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export function VideoPublicationForm({
  videoId,
  video,
  projects = [],
}: VideoPublicationFormProps) {
  const t = useTranslations("videoForm");
  const router = useRouter();

  const [state, formAction, pending] = useActionState(saveVideoPublicationAction, initialFormState);
  const [draft, setDraft] = useState<VideoFormData>(
    () => toVideoFormData(video ?? null) ?? emptyVideoFormData,
  );
  const [lastIntent, setLastIntent] = useState<VideoSaveIntent | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const visibilityClass = getClassForBucket(video?.storage_bucket ?? null);
  const visibilityOptions = getVisibilitiesForClass(visibilityClass);

  useEffect(() => {
    if (state.status !== "success" || !lastIntent) {
      return;
    }
    if (lastIntent === "publish") {
      router.push(`/videos/${videoId}`);
    } else {
      router.refresh();
    }
  }, [state.status, lastIntent, videoId, router]);

  function submit(intent: VideoSaveIntent) {
    const form = formRef.current;
    if (!form || pending) {
      return;
    }
    setLastIntent(intent);
    const formData = new FormData(form);
    formData.set("intent", intent);
    formData.set("video_id", videoId);
    formAction(formData);
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="video-title">{t("titleLabel")}</Label>
        <Input
          id="video-title"
          name="title"
          value={draft.title}
          onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
          aria-invalid={Boolean(fieldError(state, "title"))}
          placeholder={t("titlePlaceholder")}
          maxLength={120}
        />
        {fieldError(state, "title") && (
          <p className="text-sm text-destructive">{fieldError(state, "title")}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="video-caption">{t("captionLabel")}</Label>
        <Textarea
          id="video-caption"
          name="caption"
          value={draft.caption}
          onChange={(event) => setDraft((d) => ({ ...d, caption: event.target.value }))}
          aria-invalid={Boolean(fieldError(state, "caption"))}
          placeholder={t("captionPlaceholder")}
          maxLength={2000}
        />
        {fieldError(state, "caption") && (
          <p className="text-sm text-destructive">{fieldError(state, "caption")}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="video-language">{t("languageLabel")}</Label>
          <select
            id="video-language"
            name="original_language"
            value={draft.original_language}
            onChange={(event) => setDraft((d) => ({ ...d, original_language: event.target.value }))}
            className={selectClassName}
          >
            {VIDEO_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="video-visibility">{t("visibilityLabel")}</Label>
          <select
            id="video-visibility"
            name="visibility"
            value={draft.visibility}
            onChange={(event) => setDraft((d) => ({ ...d, visibility: event.target.value }))}
            className={selectClassName}
          >
            {visibilityOptions.map((value) => (
              <option key={value} value={value}>
                {t(`visibility.${getVisibilityLabel(value)}`)}
              </option>
            ))}
          </select>
          {visibilityClass === null ? (
            <span className="text-xs text-muted-foreground">{t("visibilityHint")}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("visibilityClassHint")}</span>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="video-project">{t("projectLabel")}</Label>
        <select
          id="video-project"
          name="project_id"
          value={draft.project_id}
          onChange={(event) => setDraft((d) => ({ ...d, project_id: event.target.value }))}
          className={selectClassName}
        >
          <option value="">{t("projectNone")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">{t("projectHint")}</span>
      </div>

      {state.status === "success" && <FormMessage status="success">{state.message}</FormMessage>}
      {state.status === "error" && <FormMessage status="error">{state.message}</FormMessage>}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={() => submit("save")}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {t("saveButton")}
        </Button>
        <Button type="button" disabled={pending} onClick={() => submit("publish")}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          {t("publishButton")}
        </Button>
      </div>
    </form>
  );
}
