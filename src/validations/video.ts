import { z } from "zod";
import type { ValidationTranslator } from "@/validations/auth";
import { VIDEO_LANGUAGE_CODES, VIDEO_VISIBILITIES } from "@/config/video";
import { createOptionalTextSchema, createRequiredTextSchema } from "@/validations/fields";
import { MAX_VIDEO_CAPTION_LENGTH, MAX_VIDEO_TITLE_LENGTH } from "@/videos/constants";

export function createVideoSchema(t: ValidationTranslator) {
  return z.object({
    title: createRequiredTextSchema(t, "videoTitle", 2, MAX_VIDEO_TITLE_LENGTH),
    caption: createOptionalTextSchema(t, "videoCaption", MAX_VIDEO_CAPTION_LENGTH),
    original_language: z.enum(VIDEO_LANGUAGE_CODES, { error: t("languageInvalid") }),
    visibility: z.enum(VIDEO_VISIBILITIES, { error: t("visibilityInvalid") }),
    project_id: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().uuid().nullable(),
    ),
  });
}

export type VideoFieldsInput = z.infer<ReturnType<typeof createVideoSchema>>;
