// Data layer del feed. Las dos funciones principales:
//
//   getForYouFeed(supabase, params)     → RPC get_for_you_feed (ranking determinista)
//   getFollowingFeed(supabase, params)  → RPC get_following_feed (cronológico)
//
// Cada item llega con TODO lo necesario para renderizar (post + vídeo + autor +
// proyecto + organización + métricas agregadas) en UN solo resultado de RPC:
// NO hay N+1. La diversidad reordena DENTRO de cada página (sin eliminar ni
// cruzar páginas) y el cursor de la siguiente página se deriva del ÚLTIMO item
// del orden SQL del lote, de modo que la paginación es estable y sin duplicados.
import type { SupabaseClient } from "@supabase/supabase-js";

import { FEED_PAGE_SIZE } from "@/feed/config";
import { applyDiversity } from "@/feed/diversity";
import {
  feedLimitSchema,
  getCursorParts,
  parseCursor,
  serializeCursor,
} from "@/feed/schemas";
import type { FeedItem, FeedPageResult } from "@/feed/types";
import type { Database } from "@/types/database.types";

type ForYouRow = Database["public"]["Functions"]["get_for_you_feed"]["Returns"][number];
type FollowingRow = Database["public"]["Functions"]["get_following_feed"]["Returns"][number];

// PostgREST genera `returns table` con TODAS las columnas non-null, pero en
// runtime las columnas que provienen de LEFT JOIN (profiles, videos, projects,
// organizations) pueden devolver NULL (p. ej. un post sin vídeo o un autor sin
// avatar). Estos son los tipos REALES de fila: se aplican en la frontera de la
// RPC (cast) para que el mapper y la UI traten la nullabilidad tal y como la
// devuelve Postgres.
type LeftJoinTextKeys =
  | "post_body"
  | "author_full_name"
  | "author_username"
  | "author_avatar_url"
  | "video_id"
  | "video_title"
  | "video_caption"
  | "video_thumbnail_path"
  | "video_thumbnail_bucket"
  | "video_poster_path"
  | "video_poster_bucket"
  | "project_id"
  | "project_name"
  | "project_slug"
  | "organization_id"
  | "organization_name"
  | "organization_slug";

type LeftJoinNumberKeys = "video_duration_seconds" | "video_width" | "video_height";

export type ForYouFeedRow = Omit<ForYouRow, LeftJoinTextKeys | LeftJoinNumberKeys> &
  { [K in LeftJoinTextKeys]: string | null } &
  { [K in LeftJoinNumberKeys]: number | null };

export type FollowingFeedRow = Omit<FollowingRow, LeftJoinTextKeys | LeftJoinNumberKeys> &
  { [K in LeftJoinTextKeys]: string | null } &
  { [K in LeftJoinNumberKeys]: number | null };

export type ForYouFeedParams = {
  limit?: number;
  cursor?: string | null;
};

export type FollowingFeedParams = {
  limit?: number;
  cursor?: string | null;
};

function mapForYouRow(row: ForYouFeedRow): FeedItem {
  return {
    post: {
      id: row.post_id,
      postType: row.post_post_type,
      body: row.post_body,
      createdAt: row.post_created_at,
      updatedAt: row.post_updated_at,
      publishedAt: row.published_at,
    },
    author: {
      id: row.author_id,
      fullName: row.author_full_name,
      username: row.author_username,
      avatarUrl: row.author_avatar_url,
    },
    video: row.video_id
      ? {
          id: row.video_id,
          title: row.video_title ?? "",
          caption: row.video_caption,
          thumbnailPath: row.video_thumbnail_path,
          thumbnailBucket: row.video_thumbnail_bucket,
          posterPath: row.video_poster_path,
          posterBucket: row.video_poster_bucket,
          durationSeconds: row.video_duration_seconds,
          width: row.video_width,
          height: row.video_height,
        }
      : null,
    project: row.project_id
      ? { id: row.project_id, name: row.project_name ?? "", slug: row.project_slug ?? "" }
      : null,
    organization: row.organization_id
      ? {
          id: row.organization_id,
          name: row.organization_name ?? "",
          slug: row.organization_slug ?? "",
        }
      : null,
    metrics: {
      qualifiedViews: row.qualified_views,
      plays: row.plays,
      averageWatchSeconds: row.average_watch_seconds,
      averageProgress: row.average_progress,
      completionRate: row.completion_rate,
    },
    scores: {
      recency: row.recency_score,
      affinity: row.affinity_score,
      watch: row.watch_score,
      completion: row.completion_score,
      views: row.views_score,
      exploration: row.exploration_score,
      final: row.final_score,
    },
  };
}

function mapFollowingRow(row: FollowingFeedRow): FeedItem {
  return {
    post: {
      id: row.post_id,
      postType: row.post_post_type,
      body: row.post_body,
      createdAt: row.post_created_at,
      updatedAt: row.post_updated_at,
      publishedAt: row.published_at,
    },
    author: {
      id: row.author_id,
      fullName: row.author_full_name,
      username: row.author_username,
      avatarUrl: row.author_avatar_url,
    },
    video: row.video_id
      ? {
          id: row.video_id,
          title: row.video_title ?? "",
          caption: row.video_caption,
          thumbnailPath: row.video_thumbnail_path,
          thumbnailBucket: row.video_thumbnail_bucket,
          posterPath: row.video_poster_path,
          posterBucket: row.video_poster_bucket,
          durationSeconds: row.video_duration_seconds,
          width: row.video_width,
          height: row.video_height,
        }
      : null,
    project: row.project_id
      ? { id: row.project_id, name: row.project_name ?? "", slug: row.project_slug ?? "" }
      : null,
    organization: row.organization_id
      ? {
          id: row.organization_id,
          name: row.organization_name ?? "",
          slug: row.organization_slug ?? "",
        }
      : null,
    metrics: {
      qualifiedViews: row.qualified_views,
      plays: row.plays,
      averageWatchSeconds: row.average_watch_seconds,
      averageProgress: row.average_progress,
      completionRate: row.completion_rate,
    },
  };
}

function diversifyItems<T extends FeedItem>(raw: T[]): T[] {
  const keys = raw.map((item) => ({
    id: item.post.id,
    authorId: item.author?.id ?? "",
    projectId: item.project?.id ?? null,
    organizationId: item.organization?.id ?? null,
  }));
  const orderedKeys = applyDiversity(keys);
  const byId = new Map(raw.map((item) => [item.post.id, item]));
  return orderedKeys.flatMap((key) => {
    const item = byId.get(key.id);
    return item ? [item] : [];
  });
}

function resolveLimit(limit: number | undefined): number {
  const parsed = feedLimitSchema.safeParse(limit ?? FEED_PAGE_SIZE);
  return parsed.success ? (parsed.data ?? FEED_PAGE_SIZE) : FEED_PAGE_SIZE;
}

// Feed "Para ti": descubrimiento recomendado (ranking global determinista).
// Funciona para anónimos (afinidad 0, sin personalización invasiva). Nunca
// devuelve contenido no distribuible ni de autores bloqueados (lo garantiza la
// RPC SECURITY DEFINER en la BD, no esta capa).
export async function getForYouFeed(
  supabase: SupabaseClient<Database>,
  params: ForYouFeedParams = {},
): Promise<FeedPageResult> {
  const limit = resolveLimit(params.limit);
  const cursor = parseCursor(params.cursor);
  const parts = getCursorParts(cursor);

  const { data, error } = await supabase.rpc("get_for_you_feed", {
    p_limit: limit,
    p_cursor_score: parts.score ?? undefined,
    p_cursor_published_at: parts.publishedAt ?? undefined,
    p_cursor_id: parts.id ?? undefined,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as ForYouFeedRow[];
  if (rows.length === 0) {
    return { ok: true, page: { items: [], nextCursor: null } };
  }

  const rawItems = rows.map(mapForYouRow);
  const items = diversifyItems(rawItems);
  const lastRaw = rawItems[rawItems.length - 1];
  const nextCursor = serializeCursor({
    score: lastRaw.scores?.final ?? 0,
    publishedAt: lastRaw.post.publishedAt,
    id: lastRaw.post.id,
  });

  return { ok: true, page: { items, nextCursor } };
}

// Feed "Siguiendo": contenido de perfiles/proyectos/organizaciones seguidos,
// cronológico (published_at DESC, id DESC). Un post aparece UNA sola vez aunque
// coincida por varios seguidos a la vez. Si el usuario no sigue a nadie,
// devuelve el estado vacío (sin llamar a la RPC): la UI muestra la CTA Explorar.
// Los anónimos NO tienen EXECUTE sobre get_following_feed (fail-closed por ACL)
// y además la función exige auth.uid() not null: nunca obtienen un feed
// personalizado.
export async function getFollowingFeed(
  supabase: SupabaseClient<Database>,
  params: FollowingFeedParams = {},
): Promise<FeedPageResult> {
  const limit = resolveLimit(params.limit);
  const cursor = parseCursor(params.cursor);
  const parts = getCursorParts(cursor);

  const { data, error } = await supabase.rpc("get_following_feed", {
    p_limit: limit,
    p_cursor_published_at: parts.publishedAt ?? undefined,
    p_cursor_id: parts.id ?? undefined,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as FollowingFeedRow[];
  if (rows.length === 0) {
    if (parts.publishedAt == null && parts.id == null) {
      const hasFollows = await userHasFollows(supabase);
      return { ok: true, page: { items: [], nextCursor: null, hasFollows } };
    }
    return { ok: true, page: { items: [], nextCursor: null, hasFollows: true } };
  }

  const rawItems = rows.map(mapFollowingRow);
  const items = diversifyItems(rawItems);
  const lastRaw = rawItems[rawItems.length - 1];
  const nextCursor = serializeCursor({
    score: null,
    publishedAt: lastRaw.post.publishedAt,
    id: lastRaw.post.id,
  });

  return { ok: true, page: { items, nextCursor, hasFollows: true } };
}

// ¿El usuario autenticado sigue algo? (RLS garantiza que solo ve SUS follows).
// Se usa SOLO cuando la RPC vuelve vacía en la primera página para distinguir
// "no sigues a nadie" (CTA Explorar) de "sigue a gente que aún no publica".
async function userHasFollows(supabase: SupabaseClient<Database>): Promise<boolean> {
  const [profiles, projects, organizations] = await Promise.all([
    supabase.from("profile_follows").select("following_id").limit(1),
    supabase.from("project_follows").select("project_id").limit(1),
    supabase.from("organization_follows").select("organization_id").limit(1),
  ]);
  return [profiles, projects, organizations].some((res) => (res.data?.length ?? 0) > 0);
}
