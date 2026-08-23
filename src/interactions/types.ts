import type { Database } from "@/types/database.types";

export type CommentRow = Database["public"]["Tables"]["post_comments"]["Row"];
export type ProjectFeedbackRow = Database["public"]["Tables"]["project_feedback"]["Row"];
export type PostReactionRow = Database["public"]["Tables"]["post_reactions"]["Row"];
export type SavedPostRow = Database["public"]["Tables"]["saved_posts"]["Row"];
export type SavedProjectRow = Database["public"]["Tables"]["saved_projects"]["Row"];
export type SavedOpportunityRow = Database["public"]["Tables"]["saved_opportunities"]["Row"];

// Códigos de error estables (en MAYÚSCULAS) que la UI traduce. `null` = OK.
export type InteractionErrorCode =
  | "EMPTY_BODY"
  | "BODY_TOO_LONG"
  | "INVALID_PARENT"
  | "NOT_OWN_COMMENT"
  | "NOT_ALLOWED"
  | "FAILED";

export type InteractionResult = {
  error: InteractionErrorCode | null;
  errorMessage?: string;
};

export type CommentAuthorRef = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type CommentWithAuthor = CommentRow & {
  author: CommentAuthorRef | null;
};
