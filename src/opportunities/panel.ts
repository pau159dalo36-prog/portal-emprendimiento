export type PanelSectionKey =
  | "drafts"
  | "unreviewed"
  | "flagged"
  | "rejected"
  | "published"
  | "closed"
  | "filled"
  | "cancelled";

export const PANEL_SECTION_ORDER: readonly PanelSectionKey[] = [
  "unreviewed",
  "flagged",
  "rejected",
  "drafts",
  "published",
  "closed",
  "filled",
  "cancelled",
];

export type PanelOpportunityState = {
  status: string;
  moderation_status: string;
};

export function getPanelSection(
  opportunity: PanelOpportunityState,
): PanelSectionKey | null {
  if (opportunity.status === "published") {
    return opportunity.moderation_status === "unreviewed" ||
      opportunity.moderation_status === "flagged" ||
      opportunity.moderation_status === "rejected"
      ? (opportunity.moderation_status as PanelSectionKey)
      : "published";
  }
  if (opportunity.status === "closed") {
    return "closed";
  }
  if (opportunity.status === "filled") {
    return "filled";
  }
  if (opportunity.status === "cancelled") {
    return "cancelled";
  }
  return "drafts";
}

export function canPublishOpportunity(state: PanelOpportunityState): boolean {
  return state.status === "draft";
}

export function canEditOpportunity(state: PanelOpportunityState): boolean {
  return state.status === "draft" || state.status === "published";
}

export function canCloseOpportunity(state: PanelOpportunityState): boolean {
  return state.status === "published";
}

export function canFillOpportunity(state: PanelOpportunityState): boolean {
  return state.status === "published";
}

export function canCancelOpportunity(state: PanelOpportunityState): boolean {
  return state.status !== "cancelled";
}
