import { z } from "zod";

export const videoIdSchema = z.string().uuid();
export const postIdSchema = z.string().uuid();

// Token anónimo: mismo formato que el CHECK SQL
// `video_view_sessions_anon_format_check` (16-64 chars de [A-Za-z0-9-]).
export const anonymousSessionIdSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/);

// Input de `reportVideoView` (la capa de datos valida antes de llamar a la RPC).
export const reportVideoViewInputSchema = z.object({
  videoId: videoIdSchema,
  anonymousSessionId: anonymousSessionIdSchema.nullish(),
  watchDelta: z.number().finite().min(0),
  progress: z.number().finite().min(0).max(1),
});

export type ReportVideoViewInput = z.infer<typeof reportVideoViewInputSchema>;
