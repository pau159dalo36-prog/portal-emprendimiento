import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { FEED_PAGE_SIZE } from "@/feed/config";
import { getFollowingFeed, getForYouFeed } from "@/feed/data";
import type { ForYouFeedRow } from "@/feed/data";
import { parseCursor, serializeCursor } from "@/feed/schemas";
import type { Database } from "@/types/database.types";

type ForYouRow = ForYouFeedRow;

function forYouRow(overrides: Partial<ForYouRow> = {}): ForYouRow {
  return {
    post_id: "post-1",
    post_post_type: "video",
    post_body: null,
    post_created_at: "2026-08-01T10:00:00.000Z",
    post_updated_at: "2026-08-01T10:00:00.000Z",
    published_at: "2026-08-01T10:00:00.000Z",
    author_id: "author-1",
    author_full_name: "Ana",
    author_username: "ana",
    author_avatar_url: null,
    video_id: "video-1",
    video_title: "Mi vídeo",
    video_caption: null,
    video_thumbnail_path: null,
    video_thumbnail_bucket: null,
    video_poster_path: null,
    video_poster_bucket: null,
    video_duration_seconds: 60,
    video_width: 1080,
    video_height: 1920,
    project_id: "project-1",
    project_name: "Proyecto A",
    project_slug: "proyecto-a",
    organization_id: "org-1",
    organization_name: "Org A",
    organization_slug: "org-a",
    qualified_views: 10,
    plays: 10,
    average_watch_seconds: 30,
    average_progress: 0.5,
    completion_rate: 0.4,
    recency_score: 0.9,
    affinity_score: 0,
    watch_score: 0.5,
    completion_score: 0.3,
    views_score: 0.2,
    exploration_score: 0.8,
    final_score: 0.5,
    ...overrides,
  };
}

function createSupabaseSpy(options: {
  rpcResult?: { data?: unknown[]; error?: { message: string } };
  followResult?: unknown[] | null;
} = {}) {
  const calls: { method: string; args: unknown[] }[] = [];

  function rpc(...args: unknown[]) {
    calls.push({ method: "rpc", args });
    const result = options.rpcResult ?? { data: [] };
    return {
      then(onFulfilled: (value: unknown) => unknown) {
        if (result.error) {
          return Promise.resolve(onFulfilled({ data: null, error: result.error }));
        }
        return Promise.resolve(onFulfilled(result));
      },
    };
  }

  const builder = {
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return builder;
    },
    limit(...args: unknown[]) {
      calls.push({ method: "limit", args });
      const data = options.followResult ?? [];
      return {
        then(onFulfilled: (value: unknown) => unknown) {
          return Promise.resolve(onFulfilled({ data, error: null }));
        },
      };
    },
  };

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
    rpc,
  };

  return {
    supabase: supabase as unknown as SupabaseClient<Database>,
    calls,
  };
}

describe("getForYouFeed (ranking 'Para ti')", () => {
  it("anónimo obtiene feed: llama a la RPC sin cursor y con el límite por defecto", async () => {
    const { supabase, calls } = createSupabaseSpy({
      rpcResult: { data: [forYouRow()] },
    });
    const result = await getForYouFeed(supabase);

    const rpc = calls.find((call) => call.method === "rpc");
    expect(rpc?.args[0]).toBe("get_for_you_feed");
    expect(rpc?.args[1]).toMatchObject({
      p_limit: FEED_PAGE_SIZE,
      p_cursor_score: undefined,
      p_cursor_published_at: undefined,
      p_cursor_id: undefined,
    });
    expect(result.ok).toBe(true);
  });

  it("mapea el resultado de la RPC a FeedItem (sin N+1)", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: {
        data: [
          forYouRow({
            post_id: "p1",
            author_id: "a1",
            project_id: "proj-1",
            organization_id: "org-1",
            final_score: 0.99,
          }),
        ],
      },
    });
    const result = await getForYouFeed(supabase);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items).toHaveLength(1);
    const item = result.page.items[0];
    expect(item.post.id).toBe("p1");
    expect(item.author?.id).toBe("a1");
    expect(item.project?.id).toBe("proj-1");
    expect(item.organization?.id).toBe("org-1");
    expect(item.metrics.qualifiedViews).toBe(10);
    expect(item.scores?.final).toBe(0.99);
  });

  it("un post sin vídeo (texto) se mapea con video: null", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: {
        data: [forYouRow({ post_id: "t1", video_id: null, video_title: null, post_body: "hola" })],
      },
    });
    const result = await getForYouFeed(supabase);
    if (!result.ok) return;
    const item = result.page.items[0];
    expect(item.video).toBeNull();
    expect(item.post.body).toBe("hola");
  });

  it("incluye los scores del breakdown (internos, no mostrados al usuario)", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: {
        data: [
          forYouRow({
            recency_score: 0.1,
            affinity_score: 0.2,
            watch_score: 0.3,
            completion_score: 0.4,
            views_score: 0.5,
            exploration_score: 0.6,
            final_score: 0.7,
          }),
        ],
      },
    });
    const result = await getForYouFeed(supabase);
    if (!result.ok) return;
    expect(result.page.items[0].scores).toEqual({
      recency: 0.1,
      affinity: 0.2,
      watch: 0.3,
      completion: 0.4,
      views: 0.5,
      exploration: 0.6,
      final: 0.7,
    });
  });

  it("con cursor serializa score/publishedAt/id en el siguiente", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: {
        data: [
          forYouRow({ post_id: "p1", published_at: "2026-08-01T10:00:00.000Z", final_score: 0.42 }),
          forYouRow({ post_id: "p2", published_at: "2026-08-02T10:00:00.000Z", final_score: 0.31 }),
        ],
      },
    });
    const result = await getForYouFeed(supabase);
    if (!result.ok) return;

    const parts = parseCursor(result.page.nextCursor ?? "");
    expect(parts).toEqual({
      score: 0.31,
      publishedAt: "2026-08-02T10:00:00.000Z",
      id: "p2",
    });
  });

  it("el cursor se deriva del ÚLTIMO item del orden SQL (no del reordenado)", async () => {
    // 3 posts del mismo autor → la diversidad reordena, pero el cursor usa el
    // último del orden SQL (p3), no el último del orden mostrado.
    const { supabase } = createSupabaseSpy({
      rpcResult: {
        data: [
          forYouRow({ post_id: "p1", author_id: "a", published_at: "2026-08-01T10:00:00.000Z", final_score: 0.9 }),
          forYouRow({ post_id: "p2", author_id: "a", published_at: "2026-08-01T09:00:00.000Z", final_score: 0.8 }),
          forYouRow({ post_id: "p3", author_id: "a", published_at: "2026-08-01T08:00:00.000Z", final_score: 0.7 }),
        ],
      },
    });
    const result = await getForYouFeed(supabase);
    if (!result.ok) return;

    expect(result.page.items).toHaveLength(3);
    const parts = parseCursor(result.page.nextCursor ?? "");
    expect(parts?.id).toBe("p3");
    expect(parts?.publishedAt).toBe("2026-08-01T08:00:00.000Z");
  });

  it("con cursor pasa las partes deserializadas a la RPC", async () => {
    const cursor = serializeCursor({
      score: 0.5,
      publishedAt: "2026-08-01T10:00:00.000Z",
      id: "p-123",
    });
    const { supabase, calls } = createSupabaseSpy({ rpcResult: { data: [] } });
    await getForYouFeed(supabase, { cursor });

    const rpc = calls.find((call) => call.method === "rpc");
    expect(rpc?.args[1]).toMatchObject({
      p_limit: FEED_PAGE_SIZE,
      p_cursor_score: 0.5,
      p_cursor_published_at: "2026-08-01T10:00:00.000Z",
      p_cursor_id: "p-123",
    });
  });

  it("propaga el límite pedido (acotado por el schema)", async () => {
    const { supabase, calls } = createSupabaseSpy({ rpcResult: { data: [] } });
    await getForYouFeed(supabase, { limit: 5 });
    await getForYouFeed(supabase, { limit: 9999 });

    const rpcCalls = calls.filter((call) => call.method === "rpc");
    expect(rpcCalls[0].args[1]).toMatchObject({ p_limit: 5 });
    expect(rpcCalls[1].args[1]).toMatchObject({ p_limit: FEED_PAGE_SIZE });
  });

  it("devuelve página vacía sin cursor cuando la RPC vuelve vacía", async () => {
    const { supabase } = createSupabaseSpy({ rpcResult: { data: [] } });
    const result = await getForYouFeed(supabase);
    expect(result).toEqual({ ok: true, page: { items: [], nextCursor: null } });
  });

  it("devuelve error {ok:false} si la RPC falla", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: { error: { message: "boom" } },
    });
    const result = await getForYouFeed(supabase);
    expect(result).toEqual({ ok: false, error: "boom" });
  });

  it("aplica diversidad dentro de la página (sin eliminar)", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: {
        data: [
          forYouRow({ post_id: "p1", author_id: "a" }),
          forYouRow({ post_id: "p2", author_id: "a" }),
          forYouRow({ post_id: "p3", author_id: "a" }),
          forYouRow({ post_id: "p4", author_id: "b" }),
        ],
      },
    });
    const result = await getForYouFeed(supabase);
    if (!result.ok) return;

    const authors = result.page.items.map((item) => item.author?.id);
    expect(authors).toEqual(["a", "a", "b", "a"]);
    expect(result.page.items.map((i) => i.post.id).sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });
});

describe("getFollowingFeed (cronológico 'Siguiendo')", () => {
  it("llama a la RPC get_following_feed con published_at DESC", async () => {
    const { supabase, calls } = createSupabaseSpy({ rpcResult: { data: [] } });
    await getFollowingFeed(supabase);

    const rpc = calls.find((call) => call.method === "rpc");
    expect(rpc?.args[0]).toBe("get_following_feed");
    expect(rpc?.args[1]).toMatchObject({
      p_limit: FEED_PAGE_SIZE,
      p_cursor_published_at: undefined,
      p_cursor_id: undefined,
    });
  });

  it("si no sigues a nadie devuelve estado vacío con hasFollows=false", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: { data: [] },
      followResult: [],
    });
    const result = await getFollowingFeed(supabase);
    expect(result).toEqual({
      ok: true,
      page: { items: [], nextCursor: null, hasFollows: false },
    });
  });

  it("si sigues gente pero no hay posts aún, hasFollows=true", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: { data: [] },
      followResult: [{ following_id: "someone" }],
    });
    const result = await getFollowingFeed(supabase);
    if (!result.ok) return;
    expect(result.page.items).toEqual([]);
    expect(result.page.hasFollows).toBe(true);
  });

  it("mapea el contenido seguido y produce cursor", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: {
        data: [
          forYouRow({ post_id: "s1", published_at: "2026-08-03T10:00:00.000Z" }),
          forYouRow({ post_id: "s2", published_at: "2026-08-02T10:00:00.000Z" }),
        ],
      },
    });
    const result = await getFollowingFeed(supabase);
    if (!result.ok) return;

    expect(result.page.items.map((i) => i.post.id)).toEqual(["s1", "s2"]);
    expect(result.page.hasFollows).toBe(true);
    const parts = parseCursor(result.page.nextCursor ?? "");
    expect(parts).toEqual({ publishedAt: "2026-08-02T10:00:00.000Z", id: "s2" });
  });

  it("no incluye breakdown de scores (feed cronológico)", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: { data: [forYouRow({ post_id: "s1" })] },
    });
    const result = await getFollowingFeed(supabase);
    if (!result.ok) return;
    expect(result.page.items[0].scores).toBeUndefined();
  });

  it("devuelve error {ok:false} si la RPC falla", async () => {
    const { supabase } = createSupabaseSpy({
      rpcResult: { error: { message: "forbidden" } },
    });
    const result = await getFollowingFeed(supabase);
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });
});
