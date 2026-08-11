// Tests del cargador server-side de la homepage: la primera página de "Para ti"
// (y de "Siguiendo" si hay sesión) se resuelve en el servidor y viaja a la UI.
// Los scores del breakdown son internos y loadHomeFeed los ELIMINA del payload
// (PublicFeedItem = FeedItem sin `scores`), de modo que nunca llegan al cliente.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadHomeFeed } from "@/feed/home";
import type { FeedItem } from "@/feed/types";
import type { Database } from "@/types/database.types";

vi.mock("@/feed/data", () => ({
  getForYouFeed: vi.fn(),
  getFollowingFeed: vi.fn(),
}));

import { getFollowingFeed, getForYouFeed } from "@/feed/data";

const mockedGetForYouFeed = vi.mocked(getForYouFeed);
const mockedGetFollowingFeed = vi.mocked(getFollowingFeed);

function feedItem(id: string, withScores = true): FeedItem {
  return {
    post: {
      id,
      postType: "video",
      body: null,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      publishedAt: "2026-08-01T10:00:00.000Z",
    },
    author: { id: `a-${id}`, fullName: null, username: `user-${id}`, avatarUrl: null },
    video: {
      id: `v-${id}`,
      title: `Vídeo ${id}`,
      caption: null,
      thumbnailPath: null,
      thumbnailBucket: null,
      posterPath: null,
      posterBucket: null,
      durationSeconds: 60,
      width: 1080,
      height: 1920,
    },
    project: null,
    organization: null,
    metrics: {
      qualifiedViews: 0,
      plays: 0,
      averageWatchSeconds: 0,
      averageProgress: 0,
      completionRate: 0,
    },
    ...(withScores
      ? {
          scores: {
            recency: 0.9,
            affinity: 0,
            watch: 0.5,
            completion: 0.3,
            views: 0.1,
            exploration: 0.8,
            final: 0.42,
          },
        }
      : {}),
  };
}

const supabase = {} as SupabaseClient<Database>;

beforeEach(() => {
  mockedGetForYouFeed.mockReset();
  mockedGetFollowingFeed.mockReset();
});

describe("loadHomeFeed (carga server-side de la homepage)", () => {
  it("Para ti carga desde getForYouFeed", async () => {
    mockedGetForYouFeed.mockResolvedValueOnce({
      ok: true,
      page: { items: [feedItem("p1")], nextCursor: "c1" },
    });

    const feed = await loadHomeFeed(supabase, null);

    expect(mockedGetForYouFeed).toHaveBeenCalledTimes(1);
    expect(mockedGetForYouFeed.mock.calls[0][0]).toBe(supabase);
    expect(feed.forYou.ok).toBe(true);
    if (feed.forYou.ok) {
      expect(feed.forYou.items).toHaveLength(1);
      expect(feed.forYou.nextCursor).toBe("c1");
    }
  });

  it("sin sesión no llama a getFollowingFeed y deja following en null", async () => {
    mockedGetForYouFeed.mockResolvedValueOnce({ ok: true, page: { items: [], nextCursor: null } });

    const feed = await loadHomeFeed(supabase, null);

    expect(mockedGetFollowingFeed).not.toHaveBeenCalled();
    expect(feed.following).toBeNull();
  });

  it("con sesión carga también Siguiendo", async () => {
    mockedGetForYouFeed.mockResolvedValueOnce({ ok: true, page: { items: [], nextCursor: null } });
    mockedGetFollowingFeed.mockResolvedValueOnce({
      ok: true,
      page: { items: [feedItem("s1", false)], nextCursor: null, hasFollows: true },
    });

    const feed = await loadHomeFeed(supabase, "user-1");

    expect(mockedGetFollowingFeed).toHaveBeenCalledTimes(1);
    expect(feed.following?.ok).toBe(true);
    if (feed.following?.ok) {
      expect(feed.following.hasFollows).toBe(true);
    }
  });

  it("los scores internos del breakdown NO viajan a la UI (PublicFeedItem)", async () => {
    mockedGetForYouFeed.mockResolvedValueOnce({
      ok: true,
      page: { items: [feedItem("p1", true), feedItem("p2", true)], nextCursor: null },
    });
    mockedGetFollowingFeed.mockResolvedValueOnce({
      ok: true,
      page: { items: [feedItem("s1", true)], nextCursor: null },
    });

    const feed = await loadHomeFeed(supabase, "user-1");

    if (feed.forYou.ok) {
      for (const item of feed.forYou.items) {
        expect(item).not.toHaveProperty("scores");
      }
    }
    if (feed.following?.ok) {
      for (const item of feed.following.items) {
        expect(item).not.toHaveProperty("scores");
      }
    }
  });

  it("propaga el error inicial de Para ti sin romper el estado", async () => {
    mockedGetForYouFeed.mockResolvedValueOnce({ ok: false, error: "rpc down" });

    const feed = await loadHomeFeed(supabase, null);

    expect(feed.forYou).toEqual({ ok: false, error: "rpc down" });
  });
});
