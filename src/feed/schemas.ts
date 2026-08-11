// Esquemas y serialización del feed. El cursor es OPACO para la UI: la capa
// de datos lo serializa a una cadena y la UI lo guarda/reenvía sin interpretarlo.
// - Para ti:     { score, publishedAt, id }  (final_score DESC, published_at DESC, id DESC)
// - Siguiendo:   { publishedAt, id }         (published_at DESC, id DESC)
import { z } from "zod";

export const forYouCursorSchema = z.object({
  score: z.number(),
  publishedAt: z.string(),
  id: z.string(),
});

export const followingCursorSchema = z.object({
  publishedAt: z.string(),
  id: z.string(),
});

export type ForYouCursorData = z.infer<typeof forYouCursorSchema>;
export type FollowingCursorData = z.infer<typeof followingCursorSchema>;

// El límite lo acota además la BD (greatest(least(p_limit, 50), 1)).
export const feedLimitSchema = z.number().int().min(1).max(50).optional();

const CURSOR_VERSION = 1;

type SerializedCursor = {
  v: number;
  k: "fy" | "fw";
  s?: number;
  t: string;
  i: string;
};

export function serializeCursor(cursor: {
  score: number | null;
  publishedAt: string;
  id: string;
}): string {
  const payload: SerializedCursor =
    cursor.score != null
      ? { v: CURSOR_VERSION, k: "fy", s: cursor.score, t: cursor.publishedAt, i: cursor.id }
      : { v: CURSOR_VERSION, k: "fw", t: cursor.publishedAt, i: cursor.id };
  return encodeURIComponent(JSON.stringify(payload));
}

export function parseCursor(
  raw: string | null | undefined,
): ForYouCursorData | FollowingCursorData | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SerializedCursor;
    if (parsed?.v !== CURSOR_VERSION) {
      return null;
    }
    if (parsed.k === "fy" && typeof parsed.s === "number") {
      const result = forYouCursorSchema.safeParse({
        score: parsed.s,
        publishedAt: parsed.t,
        id: parsed.i,
      });
      return result.success ? result.data : null;
    }
    if (parsed.k === "fw") {
      const result = followingCursorSchema.safeParse({
        publishedAt: parsed.t,
        id: parsed.i,
      });
      return result.success ? result.data : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function getCursorParts(
  cursor: ForYouCursorData | FollowingCursorData | null,
): {
  score: number | null;
  publishedAt: string | null;
  id: string | null;
} {
  if (!cursor) {
    return { score: null, publishedAt: null, id: null };
  }
  return {
    score: "score" in cursor ? cursor.score : null,
    publishedAt: cursor.publishedAt,
    id: cursor.id,
  };
}
