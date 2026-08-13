"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Compass, Loader2, RefreshCw, Search, X } from "lucide-react";

import { OrganizationCard } from "@/components/explore/organization-card";
import { ProfileCard } from "@/components/explore/profile-card";
import { ProjectCard } from "@/components/explore/project-card";
import { VideoCard } from "@/components/explore/video-card";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  searchOrganizations,
  searchProfiles,
  searchProjects,
  searchVideos,
} from "@/search/data";
import type { ExploreInitialData } from "@/search/home";
import {
  buildExploreQuery,
  INDUSTRIES,
  LANGUAGES,
  PROJECT_STAGES,
  USER_TYPES,
  type ExploreParams,
  type ExploreTab,
} from "@/search/schemas";
import type {
  SearchOrganization,
  SearchPageResult,
  SearchProfile,
  SearchProject,
  SearchVideo,
} from "@/search/types";

// Orden de pestañas: Todo + las cuatro entidades (el usuario primero descubre
// y luego profundiza). "all" muestra una vista agrupada con CTA "Ver más".
const TAB_KEYS: ExploreTab[] = ["all", "videos", "projects", "organizations", "profiles"];

const GROUP_PREVIEW_LIMIT = 4;

type ExploreTabState<T> = {
  items: T[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

function toInitialTab<T>(tab: ExploreInitialData[keyof ExploreInitialData]): ExploreTabState<T> {
  return tab.ok
    ? {
        items: tab.items as T[],
        nextCursor: tab.nextCursor,
        loading: false,
        loadingMore: false,
        error: null,
      }
    : {
        items: [],
        nextCursor: null,
        loading: false,
        loadingMore: false,
        error: tab.error,
      };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}

// Hook por pestaña: la página 1 llega del servidor (props initial); el cliente
// solo pide "cargar más" con el cursor y reintenta si la página 1 falló. El
// fallo NUNCA destruye los items ya cargados. La carga de página 1 y la de
// "cargar más" comparten un contador de request: gana la última (evita carreras).
function useTabData<T extends { id: string }>(
  initial: ExploreInitialData[keyof ExploreInitialData],
  loader: (cursor: string | null) => Promise<SearchPageResult<T>>,
) {
  const [state, setState] = useState<ExploreTabState<T>>(() => toInitialTab<T>(initial));

  const loaderRef = useRef(loader);
  const requestIdRef = useRef(0);

  const loadMore = useCallback(() => {
    if (state.loading || state.loadingMore || !state.nextCursor) {
      return;
    }
    const cursor = state.nextCursor;
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loadingMore: true }));
    loaderRef.current(cursor).then((result) => {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setState((prev) => {
        if (!result.ok) {
          return { ...prev, loadingMore: false, error: result.error };
        }
        return {
          ...prev,
          items: mergeById(prev.items, result.page.items),
          nextCursor: result.page.nextCursor,
          loadingMore: false,
          error: null,
        };
      });
    });
  }, [state.loading, state.loadingMore, state.nextCursor]);

  // Reintento de la página 1 cuando el estado inicial del servidor fue error.
  const retry = useCallback(() => {
    if (state.loading || state.loadingMore) {
      return;
    }
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    loaderRef.current(null).then(
      (result) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setState((prev) => {
          if (!result.ok) {
            return { ...prev, loading: false, error: result.error };
          }
          return {
            ...prev,
            items: result.page.items,
            nextCursor: result.page.nextCursor,
            loading: false,
            error: null,
          };
        });
      },
      () => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setState((prev) => ({ ...prev, loading: false, error: "explore.loadError" }));
      },
    );
  }, [state.loading, state.loadingMore]);

  return { state, loadMore, retry };
}

type ExploreAppProps = {
  initialParams: ExploreParams;
  initial: ExploreInitialData;
  currentUserId?: string | null;
};

// Hub de exploración. La URL es la fuente de verdad: pestaña, orden, query y
// filtros viven en el query string (validados con Zod en el server). Cualquier
// cambio navega con router.replace y la página se remonta con datos frescos.
// "Cargar más" sí es client-side (cursor).
export function ExploreApp({ initialParams, initial, currentUserId = null }: ExploreAppProps) {
  const t = useTranslations("explore");
  const commonT = useTranslations("common");
  const typesT = useTranslations("types");
  const stagesT = useTranslations("projectStages");
  const industriesT = useTranslations("industries");
  const router = useRouter();

  const { q, tab, sort, role, language, stage, industry } = initialParams;
  const [input, setInput] = useState(q);

  const navigate = useCallback(
    (next: Partial<ExploreParams>) => {
      const query = buildExploreQuery({ ...initialParams, ...next });
      router.replace(query ? { pathname: "/explorar", query } : "/explorar");
    },
    [initialParams, router],
  );

  const profiles = useTabData<SearchProfile>(initial.profiles, (cursor) =>
    searchProfiles(createClient(), {
      query: q,
      cursor,
      sort,
      role: role || null,
      language: language || null,
    }),
  );

  const projects = useTabData<SearchProject>(initial.projects, (cursor) =>
    searchProjects(createClient(), {
      query: q,
      cursor,
      sort,
      stage: stage || null,
      industry: industry || null,
    }),
  );

  const organizations = useTabData<SearchOrganization>(initial.organizations, (cursor) =>
    searchOrganizations(createClient(), {
      query: q,
      cursor,
      sort,
      industry: industry || null,
    }),
  );

  const videos = useTabData<SearchVideo>(initial.videos, (cursor) =>
    searchVideos(createClient(), {
      query: q,
      cursor,
      sort,
      language: language || null,
    }),
  );

  const active = tab === "profiles" ? profiles : tab === "projects" ? projects : tab === "organizations" ? organizations : videos;

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    navigate({ q: input.trim() });
  }

  const selectClass =
    "h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30 dark:border-input/60";

  // Chips de filtros activos (solo en pestañas de entidad) + Limpiar filtros.
  const activeChips: { key: string; label: string; clear: Partial<ExploreParams> }[] = [];
  if (tab === "profiles") {
    if (role) activeChips.push({ key: "role", label: typesT(role), clear: { role: "" } });
    if (language) activeChips.push({ key: "language", label: t(`languages.${language}` as never), clear: { language: "" } });
  }
  if (tab === "projects") {
    if (stage) activeChips.push({ key: "stage", label: stagesT(stage), clear: { stage: "" } });
    if (industry) activeChips.push({ key: "industry", label: industriesT(industry), clear: { industry: "" } });
  }
  if (tab === "organizations" && industry) {
    activeChips.push({ key: "industry", label: industriesT(industry), clear: { industry: "" } });
  }
  if (tab === "videos" && language) {
    activeChips.push({ key: "language", label: t(`languages.${language}` as never), clear: { language: "" } });
  }

  function clearAllFilters() {
    if (tab === "profiles") navigate({ role: "", language: "" });
    else if (tab === "projects") navigate({ stage: "", industry: "" });
    else if (tab === "organizations") navigate({ industry: "" });
    else if (tab === "videos") navigate({ language: "" });
  }

  const emptyState = (hasQuery: boolean) => (
    <section className="grid gap-6 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {hasQuery ? <Search className="size-7" aria-hidden="true" /> : <Compass className="size-7" aria-hidden="true" />}
      </div>
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">
          {hasQuery ? t("emptyResultsTitle") : t("emptyTitle")}
        </h2>
        <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
          {hasQuery ? t("emptyResultsDescription") : t("emptyDescription")}
        </p>
      </div>
    </section>
  );

  const errorState = (tabState: { error: string | null; retry: () => void; state: ExploreTabState<unknown> }) => (
    <section className="grid gap-4 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
      <div className="mx-auto grid max-w-md gap-2">
        <p className="text-sm leading-6 text-muted-foreground">{t("loadError")}</p>
        <FormMessage status="error">{tabState.error}</FormMessage>
      </div>
      <div className="flex justify-center">
        <Button type="button" variant="outline" onClick={tabState.retry} disabled={tabState.state.loading}>
          {tabState.state.loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {t("retry")}
        </Button>
      </div>
    </section>
  );

  const renderTabBody = (tabState: { state: ExploreTabState<unknown>; retry: () => void }) => {
    const { state } = tabState;
    if (state.error && state.items.length === 0) {
      return errorState(tabState as never);
    }
    if (state.items.length === 0) {
      return emptyState(Boolean(q));
    }
    return null;
  };

  // Vista agrupada de "Todo": preview de cada entidad + CTA "Ver más".
  const allGroups = [
    { key: "videos" as const, items: videos.state.items as SearchVideo[], render: (v: SearchVideo) => <VideoCard key={v.id} video={v} /> },
    { key: "projects" as const, items: projects.state.items as SearchProject[], render: (p: SearchProject) => <ProjectCard key={p.id} project={p} /> },
    { key: "organizations" as const, items: organizations.state.items as SearchOrganization[], render: (o: SearchOrganization) => <OrganizationCard key={o.id} organization={o} /> },
    { key: "profiles" as const, items: profiles.state.items as SearchProfile[], render: (p: SearchProfile) => <ProfileCard key={p.id} profile={p} currentUserId={currentUserId} /> },
  ];
  const allHasItems = allGroups.some((group) => group.items.length > 0);
  const anyAllError = [videos, projects, organizations, profiles].some((s) => s.state.error && s.state.items.length === 0);

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

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label={t("tabsLabel")} className="flex flex-wrap gap-2">
            {TAB_KEYS.map((key) => {
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => navigate({ tab: key })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                  )}
                >
                  {t(`tab${key.charAt(0).toUpperCase()}${key.slice(1)}` as never)}
                </button>
              );
            })}
          </div>

          {tab !== "all" && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="sr-only">{t("sortLabel")}</label>
              <select
                value={sort}
                onChange={(event) => navigate({ sort: event.target.value as ExploreParams["sort"] })}
                className={selectClass}
                aria-label={t("sortLabel")}
              >
                <option value="relevance">{t("sortRelevance")}</option>
                <option value="recent">{t("sortRecent")}</option>
              </select>

              {tab === "profiles" && (
                <>
                  <label className="sr-only">{t("filterRole")}</label>
                  <select
                    value={role}
                    onChange={(event) => navigate({ role: event.target.value })}
                    className={selectClass}
                    aria-label={t("filterRole")}
                  >
                    <option value="">{t("allRoles")}</option>
                    {USER_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {typesT(value)}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only">{t("filterLanguage")}</label>
                  <select
                    value={language}
                    onChange={(event) => navigate({ language: event.target.value })}
                    className={selectClass}
                    aria-label={t("filterLanguage")}
                  >
                    <option value="">{t("allLanguages")}</option>
                    {LANGUAGES.map((value) => (
                      <option key={value} value={value}>
                        {t(`languages.${value}` as never)}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {tab === "projects" && (
                <>
                  <label className="sr-only">{t("filterStage")}</label>
                  <select
                    value={stage}
                    onChange={(event) => navigate({ stage: event.target.value })}
                    className={selectClass}
                    aria-label={t("filterStage")}
                  >
                    <option value="">{t("allStages")}</option>
                    {PROJECT_STAGES.map((value) => (
                      <option key={value} value={value}>
                        {stagesT(value)}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only">{t("filterIndustry")}</label>
                  <select
                    value={industry}
                    onChange={(event) => navigate({ industry: event.target.value })}
                    className={selectClass}
                    aria-label={t("filterIndustry")}
                  >
                    <option value="">{t("allIndustries")}</option>
                    {INDUSTRIES.map((value) => (
                      <option key={value} value={value}>
                        {industriesT(value)}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {tab === "organizations" && (
                <>
                  <label className="sr-only">{t("filterIndustry")}</label>
                  <select
                    value={industry}
                    onChange={(event) => navigate({ industry: event.target.value })}
                    className={selectClass}
                    aria-label={t("filterIndustry")}
                  >
                    <option value="">{t("allIndustries")}</option>
                    {INDUSTRIES.map((value) => (
                      <option key={value} value={value}>
                        {industriesT(value)}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {tab === "videos" && (
                <>
                  <label className="sr-only">{t("filterLanguage")}</label>
                  <select
                    value={language}
                    onChange={(event) => navigate({ language: event.target.value })}
                    className={selectClass}
                    aria-label={t("filterLanguage")}
                  >
                    <option value="">{t("allLanguages")}</option>
                    {LANGUAGES.map((value) => (
                      <option key={value} value={value}>
                        {t(`languages.${value}` as never)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
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
      </div>

      {q && tab !== "all" && (
        <p className="text-sm text-muted-foreground">
          {active.state.items.length > 0
            ? t("resultsFor", { query: q })
            : t("noResultsFor", { query: q })}
        </p>
      )}

      <div role="tabpanel" className="grid gap-6">
        {tab === "all" ? (
          anyAllError ? (
            errorState({ error: (videos.state.error ?? projects.state.error ?? organizations.state.error ?? profiles.state.error) ?? "", retry: () => [videos, projects, organizations, profiles].forEach((s) => s.retry()), state: { items: [], nextCursor: null, loading: false, loadingMore: false, error: null } })
          ) : !allHasItems ? (
            emptyState(Boolean(q))
          ) : (
            allGroups.map((group) => {
              const groupState = group.key === "videos" ? videos : group.key === "projects" ? projects : group.key === "organizations" ? organizations : profiles;
              if (group.items.length === 0) {
                return null;
              }
              return (
                <section key={group.key} className="grid gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">
                      {t(`tab${group.key.charAt(0).toUpperCase()}${group.key.slice(1)}` as never)}
                    </h2>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate({ tab: group.key })}
                    >
                      {t("seeMore")}
                      <span className="sr-only">{t("seeMoreSr", { section: t(`tab${group.key.charAt(0).toUpperCase()}${group.key.slice(1)}` as never) })}</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.items.slice(0, GROUP_PREVIEW_LIMIT).map((item) => group.render(item as never))}
                  </div>
                  {groupState.state.error && (
                    <FormMessage status="error">{groupState.state.error}</FormMessage>
                  )}
                </section>
              );
            })
          )
        ) : (
          <>
            {(() => {
              const tabState = active as { state: ExploreTabState<unknown>; retry: () => void };
              const body = renderTabBody(tabState);
              if (body) {
                return body;
              }
              return (
                <>
                  {tab === "profiles" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {(active.state.items as SearchProfile[]).map((profile) => (
                        <ProfileCard key={profile.id} profile={profile} currentUserId={currentUserId} />
                      ))}
                    </div>
                  )}
                  {tab === "projects" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {(active.state.items as SearchProject[]).map((project) => (
                        <ProjectCard key={project.id} project={project} />
                      ))}
                    </div>
                  )}
                  {tab === "organizations" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {(active.state.items as SearchOrganization[]).map((organization) => (
                        <OrganizationCard key={organization.id} organization={organization} />
                      ))}
                    </div>
                  )}
                  {tab === "videos" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {(active.state.items as SearchVideo[]).map((video) => (
                        <VideoCard key={video.id} video={video} />
                      ))}
                    </div>
                  )}

                  {active.state.error && (
                    <FormMessage status="error">{t("loadMoreError")}</FormMessage>
                  )}

                  {active.state.nextCursor && (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={active.loadMore}
                        disabled={active.state.loading || active.state.loadingMore}
                      >
                        {active.state.loadingMore ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        {active.state.loadingMore ? commonT("loading") : t("loadMore")}
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
