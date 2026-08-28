"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw, Search, Store, X } from "lucide-react";

import { ServiceCard } from "@/components/explore/service-card";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { searchServices } from "@/search/data";
import {
  buildMarketQuery,
  SERVICE_CATEGORIES,
  SERVICE_DELIVERY_MODES,
  SERVICE_PRICING_TYPES,
  type MarketParams,
} from "@/search/schemas";
import type { SearchPageResult, SearchService } from "@/search/types";

type ServiceMarketProps = {
  initialParams: MarketParams;
  initial: SearchPageResult<SearchService>;
};

// Mercado de servicios (/servicios): una entidad con los filtros propios
// (categoría, modo de entrega y tipo de precio). La URL es la fuente de verdad
// (query validada con Zod en el server); la página 1 llega como prop y
// "Cargar más" es client-side (cursor keyset).
export function ServiceMarket({ initialParams, initial }: ServiceMarketProps) {
  const t = useTranslations("services");
  const commonT = useTranslations("common");
  const router = useRouter();

  const { q, sort, category, deliveryMode, pricingType } = initialParams;
  const [input, setInput] = useState(q);
  const [items, setItems] = useState<SearchService[]>(
    initial.ok ? initial.page.items : [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(
    initial.ok ? initial.page.nextCursor : null,
  );
  const [initialError, setInitialError] = useState<string | null>(
    initial.ok ? null : initial.error,
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const navigate = useCallback(
    (next: Partial<MarketParams>) => {
      const query = buildMarketQuery({ ...initialParams, ...next });
      router.push(query ? { pathname: "/servicios", query } : "/servicios");
    },
    [initialParams, router],
  );

  const loader = useCallback(
    (cursor: string | null) =>
      searchServices(createClient(), {
        query: q,
        cursor,
        sort,
        category: category || null,
        deliveryMode: deliveryMode || null,
        pricingType: pricingType || null,
      }),
    [q, sort, category, deliveryMode, pricingType],
  );

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !nextCursor) {
      return;
    }
    const cursor = nextCursor;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    loader(cursor).then((result) => {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setLoadingMore(false);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      const seen = new Set(items.map((item) => item.id));
      setItems((prev) => [...prev, ...result.page.items.filter((item) => !seen.has(item.id))]);
      setNextCursor(result.page.nextCursor);
      setLoadError(null);
    });
  }, [loader, nextCursor, loading, loadingMore, items]);

  const retry = useCallback(() => {
    if (loading || loadingMore) {
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setInitialError(null);
    loader(null).then(
      (result) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
        if (!result.ok) {
          setInitialError(result.error);
          return;
        }
        setItems(result.page.items);
        setNextCursor(result.page.nextCursor);
      },
      () => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
        setInitialError("services.loadError");
      },
    );
  }, [loader, loading, loadingMore]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    navigate({ q: input.trim() });
  }

  const selectClass =
    "h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30 dark:border-input/60";

  const activeChips: { key: string; label: string; clear: Partial<MarketParams> }[] = [];
  if (category) activeChips.push({ key: "category", label: t(`categories.${category}` as never), clear: { category: "" } });
  if (deliveryMode) activeChips.push({ key: "deliveryMode", label: t(`deliveryModes.${deliveryMode}` as never), clear: { deliveryMode: "" } });
  if (pricingType) activeChips.push({ key: "pricingType", label: t(`pricingTypes.${pricingType}` as never), clear: { pricingType: "" } });

  function clearAllFilters() {
    navigate({ category: "", deliveryMode: "", pricingType: "" });
  }

  if (initialError && items.length === 0) {
    return (
      <section className="grid gap-4 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
        <div className="mx-auto grid max-w-md gap-2">
          <p className="text-sm leading-6 text-muted-foreground">{t("loadError")}</p>
          <FormMessage status="error">{initialError}</FormMessage>
        </div>
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={retry} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            {t("retry")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <form role="search" onSubmit={submitSearch} className="mx-auto w-full max-w-2xl">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            className="h-11 pl-9 pr-10"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                navigate({ q: "" });
              }}
              aria-label={t("clearSearch")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="sr-only">{t("sortLabel")}</label>
          <select
            value={sort}
            onChange={(event) => navigate({ sort: event.target.value as MarketParams["sort"] })}
            className={selectClass}
            aria-label={t("sortLabel")}
          >
            <option value="relevance">{t("sortRelevance")}</option>
            <option value="recent">{t("sortRecent")}</option>
          </select>

          <label className="sr-only">{t("filterCategory")}</label>
          <select
            value={category}
            onChange={(event) => navigate({ category: event.target.value })}
            className={selectClass}
            aria-label={t("filterCategory")}
          >
            <option value="">{t("allCategories")}</option>
            {SERVICE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(`categories.${value}` as never)}
              </option>
            ))}
          </select>

          <label className="sr-only">{t("filterDeliveryMode")}</label>
          <select
            value={deliveryMode}
            onChange={(event) => navigate({ deliveryMode: event.target.value })}
            className={selectClass}
            aria-label={t("filterDeliveryMode")}
          >
            <option value="">{t("allDeliveryModes")}</option>
            {SERVICE_DELIVERY_MODES.map((value) => (
              <option key={value} value={value}>
                {t(`deliveryModes.${value}` as never)}
              </option>
            ))}
          </select>

          <label className="sr-only">{t("filterPricingType")}</label>
          <select
            value={pricingType}
            onChange={(event) => navigate({ pricingType: event.target.value })}
            className={selectClass}
            aria-label={t("filterPricingType")}
          >
            <option value="">{t("allPricingTypes")}</option>
            {SERVICE_PRICING_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`pricingTypes.${value}` as never)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label={t("activeFilters")}>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => navigate(chip.clear)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
            >
              {chip.label}
              <X className="size-3.5" aria-hidden="true" />
              <span className="sr-only">{t("removeFilter", { name: chip.label })}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
          >
            {t("clearFilters")}
          </button>
        </div>
      )}

      {q && (
        <p className="text-sm text-muted-foreground">
          {items.length > 0 ? t("resultsFor", { count: items.length, query: q }) : t("noResultsFor", { query: q })}
        </p>
      )}

      {items.length === 0 ? (
        <section className="grid gap-6 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {q ? <Search className="size-7" aria-hidden="true" /> : <Store className="size-7" aria-hidden="true" />}
          </div>
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold">
              {q ? t("emptyResultsTitle") : t("emptyTitleShort")}
            </h2>
            <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
              {q ? t("emptyResultsDescription") : t("emptyDescription")}
            </p>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}

      {loadError && <FormMessage status="error">{t("loadMoreError")}</FormMessage>}

      {nextCursor && items.length > 0 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={loadMore}
            disabled={loading || loadingMore}
          >
            {loadingMore ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {loadingMore ? commonT("loading") : t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
