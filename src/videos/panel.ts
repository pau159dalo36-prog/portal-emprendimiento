export type PanelSectionKey =
  | "uploading"
  | "drafts"
  | "unreviewed"
  | "flagged"
  | "rejected"
  | "published"
  | "hidden"
  | "archived"
  | "failed";

export const PANEL_SECTION_ORDER: readonly PanelSectionKey[] = [
  "uploading",
  "unreviewed",
  "flagged",
  "rejected",
  "drafts",
  "published",
  "hidden",
  "archived",
  "failed",
];

export type PanelVideoState = {
  processing_status: string;
  status: string;
  moderation_status: string;
};

export function getPanelSection(video: PanelVideoState): PanelSectionKey | null {
  if (video.processing_status === "uploading") {
    return "uploading";
  }
  if (video.processing_status === "failed") {
    return "failed";
  }
  if (video.status === "removed") {
    return null;
  }
  if (video.status === "published") {
    return "published";
  }
  if (video.status === "hidden") {
    return "hidden";
  }
  if (video.status === "archived") {
    return "archived";
  }
  if (video.moderation_status === "unreviewed") {
    return "unreviewed";
  }
  if (video.moderation_status === "flagged") {
    return "flagged";
  }
  if (video.moderation_status === "rejected") {
    return "rejected";
  }
  return "drafts";
}

export function canPublishVideo(video: PanelVideoState): boolean {
  if (
    video.status === "published" ||
    video.status === "hidden" ||
    video.status === "archived" ||
    video.status === "removed"
  ) {
    return false;
  }
  if (
    video.processing_status === "uploading" ||
    video.processing_status === "failed"
  ) {
    return false;
  }
  return true;
}

export function canRetractVideo(video: PanelVideoState): boolean {
  return video.status === "published";
}

export function canArchiveVideo(video: PanelVideoState): boolean {
  if (video.status === "archived" || video.status === "removed") {
    return false;
  }
  if (video.processing_status === "uploading" || video.processing_status === "failed") {
    return false;
  }
  return true;
}

export function canUnarchiveVideo(video: PanelVideoState): boolean {
  return video.status === "archived";
}

export function canEditVideo(video: PanelVideoState): boolean {
  return video.status !== "removed";
}

export function canDeleteVideo(video: PanelVideoState): boolean {
  return video.status !== "removed";
}
