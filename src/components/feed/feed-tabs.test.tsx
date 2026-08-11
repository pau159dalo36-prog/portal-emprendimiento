// Tests de UI de las pestañas del feed. La primera página se carga en el
// servidor y llega por props (initialForYou / initialFollowing); la UI solo
// pide páginas siguientes con su cursor. Por eso getForYouFeed/getFollowingFeed
// se mockean aquí para verificar "Cargar más", reintentos y errores.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeedTabs } from "@/components/feed/feed-tabs";
import type { HomeFeedPage } from "@/feed/home";
import type { PublicFeedItem } from "@/feed/types";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, className, children }: { href: unknown; className?: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/proyectos"} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/feed/data", () => ({
  getForYouFeed: vi.fn(),
  getFollowingFeed: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}) as never,
}));

vi.mock("@/lib/env", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
  getSupabasePublishableKey: () => "anon-key",
}));

import { getFollowingFeed, getForYouFeed } from "@/feed/data";

const mockedGetForYouFeed = vi.mocked(getForYouFeed);
const mockedGetFollowingFeed = vi.mocked(getFollowingFeed);

function item(id: string): PublicFeedItem {
  return {
    post: {
      id,
      postType: "video",
      body: null,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      publishedAt: "2026-08-01T10:00:00.000Z",
    },
    author: { id: `a-${id}`, fullName: `Autor ${id}`, username: null, avatarUrl: null },
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
  };
}

function okPage(items: PublicFeedItem[], nextCursor: string | null): HomeFeedPage {
  return { ok: true, items, nextCursor };
}

function renderFeed(props: {
  isAuthenticated?: boolean;
  initialForYou?: HomeFeedPage;
  initialFollowing?: HomeFeedPage | null;
} = {}) {
  return render(
    <FeedTabs
      isAuthenticated={props.isAuthenticated ?? true}
      initialForYou={props.initialForYou ?? okPage([], null)}
      initialFollowing={props.initialFollowing ?? null}
    />,
  );
}

beforeEach(() => {
  mockedGetForYouFeed.mockReset();
  mockedGetFollowingFeed.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("FeedTabs — pestañas", () => {
  it("Para ti renderiza los items de la primera página cargada en el servidor", () => {
    renderFeed({ initialForYou: okPage([item("p1"), item("p2")], null) });

    expect(screen.getByText("Vídeo p1")).toBeInTheDocument();
    expect(screen.getByText("Vídeo p2")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "feed.forYou" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("cambio a Siguiendo muestra el feed cronológico del usuario autenticado", async () => {
    const user = userEvent.setup();
    renderFeed({
      isAuthenticated: true,
      initialFollowing: okPage([item("s1")], null),
    });

    await user.click(screen.getByRole("tab", { name: "feed.following" }));

    expect(screen.getByText("Vídeo s1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "feed.following" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("un anónimo recibe la CTA de inicio de sesión en Siguiendo", async () => {
    const user = userEvent.setup();
    renderFeed({ isAuthenticated: false });

    await user.click(screen.getByRole("tab", { name: "feed.following" }));

    expect(screen.getByText("feed.signInCtaTitle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "feed.signInCtaButton" })).toBeInTheDocument();
  });
});

describe("FeedTabs — estados vacíos", () => {
  it("estado vacío de Para ti muestra el aviso de contenido", () => {
    renderFeed({ initialForYou: okPage([], null) });

    expect(screen.getByText("videos.emptyTitle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "feed.explore" })).toBeInTheDocument();
  });

  it("Siguiendo sin follows muestra la CTA de explorar proyectos", async () => {
    const user = userEvent.setup();
    renderFeed({
      isAuthenticated: true,
      initialFollowing: { ok: true, items: [], nextCursor: null, hasFollows: false },
    });

    await user.click(screen.getByRole("tab", { name: "feed.following" }));

    expect(screen.getByText("feed.followingEmptyTitle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "feed.explore" })).toBeInTheDocument();
  });

  it("Siguiendo con follows pero sin posts muestra el aviso de publicación", async () => {
    const user = userEvent.setup();
    renderFeed({
      isAuthenticated: true,
      initialFollowing: { ok: true, items: [], nextCursor: null, hasFollows: true },
    });

    await user.click(screen.getByRole("tab", { name: "feed.following" }));

    expect(screen.getByText("feed.followingNoPostsTitle")).toBeInTheDocument();
  });
});

describe("FeedTabs — Cargar más", () => {
  it("pide la siguiente página con el cursor y la añade", async () => {
    const user = userEvent.setup();
    mockedGetForYouFeed.mockResolvedValueOnce({
      ok: true,
      page: { items: [item("p2")], nextCursor: null },
    });
    renderFeed({ initialForYou: okPage([item("p1")], "cursor-1") });

    await user.click(screen.getByText("feed.loadMore"));

    expect(await screen.findByText("Vídeo p2")).toBeInTheDocument();
    expect(mockedGetForYouFeed).toHaveBeenCalledTimes(1);
    expect(mockedGetForYouFeed.mock.calls[0][1]).toEqual({ cursor: "cursor-1" });
  });

  it("desaparece al no existir nextCursor", async () => {
    renderFeed({ initialForYou: okPage([item("p1")], null) });

    expect(screen.queryByText("feed.loadMore")).not.toBeInTheDocument();
  });

  it("no duplica posts cuando la siguiente página repite un id", async () => {
    const user = userEvent.setup();
    mockedGetForYouFeed.mockResolvedValueOnce({
      ok: true,
      page: { items: [item("p1"), item("p2")], nextCursor: null },
    });
    renderFeed({ initialForYou: okPage([item("p1")], "cursor-1") });

    await user.click(screen.getByText("feed.loadMore"));

    expect(await screen.findByText("Vídeo p2")).toBeInTheDocument();
    expect(screen.getAllByText("Vídeo p1")).toHaveLength(1);
    expect(screen.getAllByText("Vídeo p2")).toHaveLength(1);
  });

  it("un fallo al cargar la siguiente página conserva los items ya cargados", async () => {
    const user = userEvent.setup();
    mockedGetForYouFeed.mockResolvedValueOnce({ ok: false, error: "boom" });
    renderFeed({ initialForYou: okPage([item("p1")], "cursor-1") });

    await user.click(screen.getByText("feed.loadMore"));

    expect(await screen.findByText("feed.loadMoreError")).toBeInTheDocument();
    expect(screen.getByText("Vídeo p1")).toBeInTheDocument();
    expect(screen.getByText("feed.loadMore")).toBeInTheDocument();
  });

  it("el error inicial ofrece reintentar y carga la primera página", async () => {
    const user = userEvent.setup();
    mockedGetForYouFeed.mockResolvedValueOnce({
      ok: true,
      page: { items: [item("p1")], nextCursor: null },
    });
    renderFeed({ initialForYou: { ok: false, error: "server down" } });

    expect(screen.getByText("feed.loadError")).toBeInTheDocument();

    await user.click(screen.getByText("feed.retry"));

    expect(await screen.findByText("Vídeo p1")).toBeInTheDocument();
    expect(mockedGetForYouFeed.mock.calls[0][1]).toEqual({});
  });

  it("Siguiendo usa getFollowingFeed para cargar más", async () => {
    const user = userEvent.setup();
    mockedGetFollowingFeed.mockResolvedValueOnce({
      ok: true,
      page: { items: [item("s2")], nextCursor: null },
    });
    renderFeed({
      isAuthenticated: true,
      initialFollowing: okPage([item("s1")], "cursor-fw-1"),
    });

    await user.click(screen.getByRole("tab", { name: "feed.following" }));
    await user.click(screen.getByText("feed.loadMore"));

    expect(await screen.findByText("Vídeo s2")).toBeInTheDocument();
    expect(mockedGetFollowingFeed.mock.calls[0][1]).toEqual({ cursor: "cursor-fw-1" });
  });
});
