"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Compass, Loader2, LogIn, RefreshCw } from "lucide-react";

import { FeedPostCard } from "@/components/feed/feed-post-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { getFollowingFeed, getForYouFeed } from "@/feed/data";
import type { HomeFeedPage } from "@/feed/home";
import type { PublicFeedItem } from "@/feed/types";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type FeedTab = "forYou" | "following";

type FeedState = {
  items: PublicFeedItem[];
  nextCursor: string | null;
  hasFollows?: boolean;
  loading: boolean;
  error: string | null;
};

type FeedTabsProps = {
  isAuthenticated: boolean;
  initialForYou: HomeFeedPage;
  initialFollowing: HomeFeedPage | null;
};

function toState(page: HomeFeedPage): FeedState {
  if (page.ok) {
    return {
      items: page.items,
      nextCursor: page.nextCursor,
      hasFollows: page.hasFollows,
      loading: false,
      error: null,
    };
  }
  return { items: [], nextCursor: null, loading: false, error: page.error };
}

// Añade la página siguiente SIN duplicar posts (mismo post.id).
function mergeItems(current: PublicFeedItem[], incoming: PublicFeedItem[]): PublicFeedItem[] {
  const seen = new Set(current.map((item) => item.post.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.post.id))];
}

export function FeedTabs({
  isAuthenticated,
  initialForYou,
  initialFollowing,
}: FeedTabsProps) {
  const t = useTranslations("feed");
  const videosT = useTranslations("videos");
  const commonT = useTranslations("common");

  const [tab, setTab] = useState<FeedTab>("forYou");
  const [forYou, setForYou] = useState<FeedState>(() => toState(initialForYou));
  const [following, setFollowing] = useState<FeedState>(() =>
    initialFollowing
      ? toState(initialFollowing)
      : { items: [], nextCursor: null, loading: false, error: null },
  );

  const active = tab === "forYou" ? forYou : following;

  // Pide una página (null = primera página). Se usa tanto para "Cargar más"
  // (con cursor) como para reintentar tras un error inicial (sin cursor). Un
  // fallo NUNCA destruye los items ya cargados: se conserva la página anterior.
  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const isForYou = tab === "forYou";
      const setState = isForYou ? setForYou : setFollowing;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const supabase = createClient();
      const result = isForYou
        ? await getForYouFeed(supabase, cursor ? { cursor } : {})
        : await getFollowingFeed(supabase, cursor ? { cursor } : {});
      setState((prev) => {
        if (!result.ok) {
          return { ...prev, loading: false, error: result.error };
        }
        return {
          ...prev,
          items: cursor ? mergeItems(prev.items, result.page.items) : result.page.items,
          nextCursor: result.page.nextCursor,
          hasFollows: result.page.hasFollows ?? prev.hasFollows,
          loading: false,
          error: null,
        };
      });
    },
    [tab],
  );

  const handleLoadMore = useCallback(() => {
    if (active.loading || !active.nextCursor) {
      return;
    }
    void fetchPage(active.nextCursor);
  }, [active.loading, active.nextCursor, fetchPage]);

  const tabButtonClass = (isActive: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
      isActive
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
    );

  return (
    <div className="grid gap-6">
      <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "forYou"}
          onClick={() => setTab("forYou")}
          className={tabButtonClass(tab === "forYou")}
        >
          {t("forYou")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "following"}
          onClick={() => setTab("following")}
          className={tabButtonClass(tab === "following")}
        >
          {t("following")}
        </button>
      </div>

      <div role="tabpanel" className="grid gap-6">
        {tab === "following" && !isAuthenticated ? (
          <section className="grid gap-6 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LogIn className="size-7" aria-hidden="true" />
            </div>
            <div className="grid gap-2">
              <h2 className="text-xl font-semibold">{t("signInCtaTitle")}</h2>
              <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
                {t("signInCtaDescription")}
              </p>
            </div>
            <div className="flex justify-center">
              <Link href="/iniciar-sesion" className={buttonVariants()}>
                <LogIn className="size-4" aria-hidden="true" />
                {t("signInCtaButton")}
              </Link>
            </div>
          </section>
        ) : active.error && active.items.length === 0 ? (
          <section className="grid gap-4 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
            <div className="mx-auto grid max-w-md gap-2">
              <p className="text-sm leading-6 text-muted-foreground">{t("loadError")}</p>
              <FormMessage status="error">{active.error}</FormMessage>
            </div>
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => void fetchPage(null)}
                disabled={active.loading}
              >
                {active.loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                {t("retry")}
              </Button>
            </div>
          </section>
        ) : active.items.length === 0 ? (
          <section className="grid gap-6 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Compass className="size-7" aria-hidden="true" />
            </div>
            <div className="grid gap-2">
              <h2 className="text-xl font-semibold">
                {tab === "forYou"
                  ? videosT("emptyTitle")
                  : active.hasFollows === false
                    ? t("followingEmptyTitle")
                    : t("followingNoPostsTitle")}
              </h2>
              <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
                {tab === "forYou"
                  ? videosT("emptyDescription")
                  : active.hasFollows === false
                    ? t("followingEmptyDescription")
                    : t("followingNoPostsDescription")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/explorar" className={buttonVariants({ variant: "outline" })}>
                <Compass className="size-4" aria-hidden="true" />
                {t("explore")}
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {active.items.map((item) => (
                <FeedPostCard key={item.post.id} item={item} />
              ))}
            </div>

            {active.error && (
              <FormMessage status="error">{t("loadMoreError")}</FormMessage>
            )}

            {active.nextCursor && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={active.loading}
                >
                  {active.loading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {active.loading ? commonT("loading") : t("loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
