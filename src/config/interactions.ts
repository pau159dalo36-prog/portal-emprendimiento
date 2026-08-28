// Constantes de FASE 9 (interacciones). Espejo exacto de los CHECK de la
// migración 20260819000000_fase9_interacciones.sql.

export const MAX_COMMENT_BODY_LENGTH = 2000;

export const FEEDBACK_UNDERSTANDING_MIN_LENGTH = 10;
export const FEEDBACK_TEXT_MAX_LENGTH = 2000;
export const FEEDBACK_INTEREST_SCORE_MAX = 10;

export const FEEDBACK_WOULD_USE_OPTIONS = ["yes", "no", "maybe"] as const;
export type FeedbackWouldUse = (typeof FEEDBACK_WOULD_USE_OPTIONS)[number];

export const REACTION_TYPES = ["support"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const SAVE_TARGETS = ["post", "project", "opportunity", "service"] as const;
export type SaveTarget = (typeof SAVE_TARGETS)[number];

// Eventos del outbox (public.interaction_events) que consumirá FASE 10.
export const INTERACTION_EVENT_TYPES = [
  "comment_created",
  "reply_created",
  "feedback_received",
  "reaction_received",
] as const;
export type InteractionEventType = (typeof INTERACTION_EVENT_TYPES)[number];
