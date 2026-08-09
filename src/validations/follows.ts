import { z } from "zod";

export const followTargetIdSchema = z.string().uuid();

export function isFollowTargetId(value: unknown): value is string {
  return typeof value === "string" && followTargetIdSchema.safeParse(value).success;
}
