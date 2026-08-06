import type { VideoRow } from "@/videos/types";

export type VideoFormData = {
  title: string;
  caption: string;
  original_language: string;
  visibility: string;
  project_id: string;
};

export const emptyVideoFormData: VideoFormData = {
  title: "",
  caption: "",
  original_language: "es",
  visibility: "public",
  project_id: "",
};

export function toVideoFormData(video: VideoRow | null): VideoFormData {
  if (!video) {
    return emptyVideoFormData;
  }
  return {
    title: video.title,
    caption: video.caption ?? "",
    original_language: video.original_language,
    visibility: video.visibility,
    project_id: video.project_id ?? "",
  };
}
