import { VIDEO_BUCKET_PRIVATE, VIDEO_BUCKET_PUBLIC, VIDEO_THUMBNAILS_BUCKET } from "@/config/uploads";

export const VIDEO_LANGUAGES = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
] as const;

export const VIDEO_LANGUAGE_CODES = ["es", "en"] as const;

export type VideoLanguageCode = (typeof VIDEO_LANGUAGES)[number]["code"];

export const VIDEO_VISIBILITIES = [
  "public",
  "unlisted",
  "registered_users",
  "project_members",
  "private",
] as const;

export type VideoVisibility = (typeof VIDEO_VISIBILITIES)[number];

export const VIDEO_PROCESSING_STATUSES = [
  "uploading",
  "uploaded",
  "validating",
  "ready",
  "failed",
  "removed",
] as const;

export const VIDEO_MODERATION_STATUSES = ["pending", "approved", "rejected", "flagged"] as const;

export const VIDEO_PUBLICATION_STATUSES = ["draft", "published", "hidden", "removed", "archived"] as const;

export const MAX_VIDEO_TITLE_LENGTH = 120;
export const MAX_VIDEO_CAPTION_LENGTH = 2000;

export const VIDEO_BUCKETS = {
  public: VIDEO_BUCKET_PUBLIC,
  private: VIDEO_BUCKET_PRIVATE,
  thumbnails: VIDEO_THUMBNAILS_BUCKET,
} as const;

export function getLanguageLabel(code: string): string {
  return VIDEO_LANGUAGES.find((language) => language.code === code)?.name ?? code;
}

export function languageFromLocale(locale: string): VideoLanguageCode {
  return locale === "en" ? "en" : "es";
}

export function getVisibilityLabel(visibility: string): string {
  switch (visibility) {
    case "public":
      return "public";
    case "unlisted":
      return "unlisted";
    case "registered_users":
      return "registeredUsers";
    case "project_members":
      return "projectMembers";
    case "private":
      return "private";
    default:
      return "private";
  }
}
