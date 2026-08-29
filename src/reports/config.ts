export const REPORT_REASONS = [
  "spam",
  "inappropriate",
  "misinformation",
  "harassment",
  "impersonation",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGET_TYPES = [
  "post",
  "video",
  "service",
  "opportunity",
  "project",
  "organization",
  "comment",
  "profile",
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const MAX_REPORT_NOTE_LENGTH = 2000;