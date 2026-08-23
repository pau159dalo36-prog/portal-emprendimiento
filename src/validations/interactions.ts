import { z } from "zod";

import {
  FEEDBACK_INTEREST_SCORE_MAX,
  FEEDBACK_TEXT_MAX_LENGTH,
  FEEDBACK_UNDERSTANDING_MIN_LENGTH,
  FEEDBACK_WOULD_USE_OPTIONS,
  MAX_COMMENT_BODY_LENGTH,
} from "@/config/interactions";

export const commentTargetIdSchema = z.string().uuid();

export const commentBodySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_COMMENT_BODY_LENGTH);

export const createCommentSchema = z.object({
  postId: commentTargetIdSchema,
  parentId: commentTargetIdSchema.nullable(),
  body: commentBodySchema,
});

export const updateCommentSchema = z.object({
  commentId: commentTargetIdSchema,
  body: commentBodySchema,
});

export const feedbackOptionalTextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(FEEDBACK_TEXT_MAX_LENGTH).nullable(),
);

export const feedbackWouldUseSchema = z.enum(FEEDBACK_WOULD_USE_OPTIONS);

export const feedbackInterestScoreSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value);
    return value;
  },
  z
    .number()
    .int()
    .min(0)
    .max(FEEDBACK_INTEREST_SCORE_MAX)
    .nullable(),
);

export const projectFeedbackSchema = z.object({
  projectId: z.string().uuid(),
  understanding: z.string().trim().min(FEEDBACK_UNDERSTANDING_MIN_LENGTH).max(FEEDBACK_TEXT_MAX_LENGTH),
  problem: feedbackOptionalTextSchema,
  useful: feedbackOptionalTextSchema,
  unclear: feedbackOptionalTextSchema,
  suggestions: feedbackOptionalTextSchema,
  wouldUse: feedbackWouldUseSchema,
  interestScore: feedbackInterestScoreSchema,
});

export type ProjectFeedbackInput = z.infer<typeof projectFeedbackSchema>;

export function isInteractionTargetId(value: unknown): value is string {
  return typeof value === "string" && commentTargetIdSchema.safeParse(value).success;
}
