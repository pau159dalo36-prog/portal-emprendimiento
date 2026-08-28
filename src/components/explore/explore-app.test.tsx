// Tests de UI del hub Explorar. La URL es la fuente de verdad: cambiar pestaña,
// orden o filtros navega (router.replace) y la página se remonta con datos
// frescos del servidor; "cargar más" y el reintento sí son client-side. Por eso
// se mockean las cuatro funciones de `@/search/data` y el router.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExploreApp } from "@/components/explore/explore-app";
import type { ExploreInitialData } from "@/search/home";
import type { ExploreParams } from "@/search/schemas";
import type {
  SearchOpportunity,
  SearchOrganization,
  SearchProfile,
  SearchProject,
  SearchService,
  SearchVideo,
} from "@/search/types";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => "es",
}));

const { routerReplace } = vi.hoisted(() => ({
  routerReplace: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, className, children }: { href: unknown; className?: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/explorar"} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({
    push: vi.fn(),
    replace: routerReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/search/data", () => ({
  searchVideos: vi.fn(),
  searchProfiles: vi.fn(),
  searchProjects: vi.fn(),
  searchOrganizations: vi.fn(),
  searchOpportunities: vi.fn(),
  searchServices: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}) as never,
}));

vi.mock("@/lib/env", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
  getSupabasePublishableKey: () => "anon-key",
}));

import {
  searchOpportunities,
  searchOrganizations,
  searchProfiles,
  searchProjects,
  searchServices,
  searchVideos,
} from "@/search/data";

const mockedSearchVideos = vi.mocked(searchVideos);
const mockedSearchProfiles = vi.mocked(searchProfiles);
const mockedSearchProjects = vi.mocked(searchProjects);
const mockedSearchOrganizations = vi.mocked(searchOrganizations);
const mockedSearchOpportunities = vi.mocked(searchOpportunities);
const mockedSearchServices = vi.mocked(searchServices);

function video(id: string): SearchVideo {
  return {
    id,
    title: `Vídeo ${id}`,
    caption: null,
    thumbnailPath: null,
    thumbnailBucket: null,
    posterPath: null,
    posterBucket: null,
    durationSeconds: 60,
    width: null,
    height: null,
    owner: null,
    project: null,
    organization: null,
    createdAt: "2026-08-01T10:00:00.000Z",
  };
}

function profile(id: string): SearchProfile {
  return {
    id,
    fullName: `Perfil ${id}`,
    username: null,
    headline: null,
    bio: null,
    avatarUrl: null,
    location: null,
    userTypes: [],
    isFollowing: false,
    createdAt: "2026-08-01T10:00:00.000Z",
  };
}

function project(id: string): SearchProject {
  return {
    id,
    name: `Proyecto ${id}`,
    tagline: null,
    description: null,
    slug: `proyecto-${id}`,
    coverImageUrl: null,
    stage: "idea",
    industries: [],
    owner: null,
    organization: null,
    createdAt: "2026-08-01T10:00:00.000Z",
  };
}

function organization(id: string): SearchOrganization {
  return {
    id,
    name: `Organización ${id}`,
    headline: null,
    description: null,
    slug: `organizacion-${id}`,
    logoUrl: null,
    location: null,
    industries: [],
    owner: null,
    createdAt: "2026-08-01T10:00:00.000Z",
  };
}

function opportunity(id: string): SearchOpportunity {
  return {
    id,
    title: `Oportunidad ${id}`,
    description: null,
    opportunityType: "job",
    employmentType: null,
    experienceLevel: null,
    workMode: null,
    industry: null,
    country: null,
    region: null,
    city: null,
    locationText: null,
    compensationType: null,
    compensationMin: null,
    compensationMax: null,
    currency: null,
    compensationPeriod: null,
    startsAt: null,
    endsAt: null,
    slotsTotal: null,
    isFirstJobFriendly: false,
    isStudentFriendly: false,
    owner: null,
    project: null,
    organization: null,
    createdAt: "2026-08-01T10:00:00.000Z",
  };
}

function service(id: string): SearchService {
  return {
    id,
    title: `Servicio ${id}`,
    description: null,
    category: "desarrollo_web",
    deliveryMode: "remote",
    pricingType: "negotiable",
    priceAmount: null,
    priceMin: null,
    priceMax: null,
    currency: null,
    provider: null,
    createdAt: "2026-08-01T10:00:00.000Z",
  };
}

function initialData(overrides: Partial<ExploreInitialData> = {}): ExploreInitialData {
  return {
    profiles: { ok: true, items: [], nextCursor: null },
    projects: { ok: true, items: [], nextCursor: null },
    organizations: { ok: true, items: [], nextCursor: null },
    videos: { ok: true, items: [], nextCursor: null },
    opportunities: { ok: true, items: [], nextCursor: null },
    services: { ok: true, items: [], nextCursor: null },
    ...overrides,
  };
}

const defaultParams: ExploreParams = {
  q: "",
  tab: "all",
  sort: "relevance",
  role: "",
  language: "",
  stage: "",
  industry: "",
  opportunityType: "",
  workMode: "",
  experience: "",
  firstJob: "false",
  date: "",
  category: "",
  deliveryMode: "",
  pricingType: "",
};

function renderApp(props: {
  params?: Partial<ExploreParams>;
  initial?: ExploreInitialData;
  currentUserId?: string | null;
} = {}) {
  return render(
    <ExploreApp
      initialParams={{ ...defaultParams, ...props.params }}
      initial={props.initial ?? initialData()}
      currentUserId={props.currentUserId ?? null}
    />,
  );
}

beforeEach(() => {
  routerReplace.mockReset();
  mockedSearchVideos.mockReset();
  mockedSearchProfiles.mockReset();
  mockedSearchProjects.mockReset();
  mockedSearchOrganizations.mockReset();
  mockedSearchOpportunities.mockReset();
  mockedSearchServices.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("ExploreApp — pestañas", () => {
  it("Todo (pestaña por defecto) muestra la vista agrupada con previews", () => {
    renderApp({
      initial: initialData({
        videos: { ok: true, items: [video("v1"), video("v2")], nextCursor: null },
        projects: { ok: true, items: [project("pr1")], nextCursor: null },
        organizations: { ok: true, items: [organization("o1")], nextCursor: null },
        profiles: { ok: true, items: [profile("p1")], nextCursor: null },
      }),
    });

    expect(screen.getByRole("tab", { name: "explore.tabAll" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: "explore.tabVideos" })).toBeInTheDocument();
    expect(screen.getByText("Vídeo v1")).toBeInTheDocument();
    expect(screen.getByText("Vídeo v2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "explore.tabProjects" })).toBeInTheDocument();
    expect(screen.getByText("Proyecto pr1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "explore.tabOrganizations" })).toBeInTheDocument();
    expect(screen.getByText("Organización o1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "explore.tabProfiles" })).toBeInTheDocument();
    expect(screen.getByText("Perfil p1")).toBeInTheDocument();
    expect(screen.getAllByText("explore.seeMore")).toHaveLength(4);
    expect(mockedSearchVideos).not.toHaveBeenCalled();
  });

  it("cambiar de pestaña navega a /explorar con el nuevo tab", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("tab", { name: "explore.tabVideos" }));

    expect(routerReplace).toHaveBeenCalledWith({
      pathname: "/explorar",
      query: { tab: "videos" },
    });
  });

  it("la pestaña de vídeos renderiza los items iniciales del servidor sin refetch", () => {
    renderApp({
      params: { tab: "videos" },
      initial: initialData({ videos: { ok: true, items: [video("v1"), video("v2")], nextCursor: null } }),
    });

    expect(screen.getByRole("tab", { name: "explore.tabVideos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Vídeo v1")).toBeInTheDocument();
    expect(screen.getByText("Vídeo v2")).toBeInTheDocument();
    expect(mockedSearchVideos).not.toHaveBeenCalled();
  });

  it("la pestaña de oportunidades renderiza los items iniciales del servidor", () => {
    renderApp({
      params: { tab: "opportunities" },
      initial: initialData({
        opportunities: { ok: true, items: [opportunity("o1"), opportunity("o2")], nextCursor: null },
      }),
    });

    expect(screen.getByRole("tab", { name: "explore.tabOpportunities" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Oportunidad o1")).toBeInTheDocument();
    expect(screen.getByText("Oportunidad o2")).toBeInTheDocument();
    expect(mockedSearchOpportunities).not.toHaveBeenCalled();
  });

  it("la pestaña de servicios renderiza los items iniciales del servidor", () => {
    renderApp({
      params: { tab: "services" },
      initial: initialData({
        services: { ok: true, items: [service("s1"), service("s2")], nextCursor: null },
      }),
    });

    expect(screen.getByRole("tab", { name: "explore.tabServices" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Servicio s1")).toBeInTheDocument();
    expect(screen.getByText("Servicio s2")).toBeInTheDocument();
    expect(mockedSearchServices).not.toHaveBeenCalled();
  });

  it("el filtro de categoría en servicios navega con category", async () => {
    const user = userEvent.setup();
    renderApp({ params: { tab: "services" } });

    await user.selectOptions(screen.getByLabelText("explore.filterCategory"), "diseno");

    expect(routerReplace).toHaveBeenCalledWith({
      pathname: "/explorar",
      query: { tab: "services", category: "diseno" },
    });
    expect(mockedSearchServices).not.toHaveBeenCalled();
  });

  it("el filtro de tipo en oportunidades navega con opportunityType", async () => {
    const user = userEvent.setup();
    renderApp({ params: { tab: "opportunities" } });

    await user.selectOptions(screen.getByLabelText("explore.filterType"), "internship");

    expect(routerReplace).toHaveBeenCalledWith({
      pathname: "/explorar",
      query: { tab: "opportunities", opportunityType: "internship" },
    });
    expect(mockedSearchOpportunities).not.toHaveBeenCalled();
  });
});

describe("ExploreApp — seguir en tarjetas de perfil", () => {
  it("muestra el botón de seguir para otro usuario autenticado", () => {
    renderApp({
      params: { tab: "profiles" },
      currentUserId: "me",
      initial: initialData({ profiles: { ok: true, items: [profile("p1")], nextCursor: null } }),
    });

    expect(screen.getByRole("button", { name: "publicProfile.follow" })).toBeInTheDocument();
  });

  it("oculta el botón cuando el perfil es el propio usuario", () => {
    renderApp({
      params: { tab: "profiles" },
      currentUserId: "p1",
      initial: initialData({ profiles: { ok: true, items: [profile("p1")], nextCursor: null } }),
    });

    expect(screen.queryByRole("button", { name: "publicProfile.follow" })).not.toBeInTheDocument();
  });

  it("oculta el botón para visitantes anónimos", () => {
    renderApp({
      params: { tab: "profiles" },
      initial: initialData({ profiles: { ok: true, items: [profile("p1")], nextCursor: null } }),
    });

    expect(screen.queryByRole("button", { name: "publicProfile.follow" })).not.toBeInTheDocument();
  });
});

describe("ExploreApp — estados vacíos y errores", () => {
  it("estado vacío sin búsqueda muestra el aviso de contenido", () => {
    renderApp();

    expect(screen.getByText("explore.emptyTitle")).toBeInTheDocument();
  });

  it("estado vacío con búsqueda muestra el aviso de sin resultados", () => {
    renderApp({ params: { tab: "videos", q: "hola" } });

    expect(screen.getByText("explore.emptyResultsTitle")).toBeInTheDocument();
    expect(screen.getByText("explore.noResultsFor")).toBeInTheDocument();
  });

  it("el error inicial ofrece reintentar y recarga la primera página", async () => {
    const user = userEvent.setup();
    mockedSearchVideos.mockResolvedValueOnce({
      ok: true,
      page: { items: [video("v1")], nextCursor: null },
    });
    renderApp({
      params: { tab: "videos" },
      initial: initialData({ videos: { ok: false, error: "server down" } }),
    });

    expect(screen.getByText("explore.loadError")).toBeInTheDocument();

    await user.click(screen.getByText("explore.retry"));

    expect(await screen.findByText("Vídeo v1")).toBeInTheDocument();
    expect(mockedSearchVideos).toHaveBeenCalledTimes(1);
    expect(mockedSearchVideos.mock.calls[0][1]).toMatchObject({ sort: "relevance", cursor: null });
  });
});

describe("ExploreApp — orden, filtros y navegación", () => {
  it("cambiar el orden navega a /explorar con sort=recent", async () => {
    const user = userEvent.setup();
    renderApp({ params: { tab: "videos" } });

    await user.selectOptions(screen.getByLabelText("explore.sortLabel"), "recent");

    expect(routerReplace).toHaveBeenCalledWith({
      pathname: "/explorar",
      query: { tab: "videos", sort: "recent" },
    });
    expect(mockedSearchVideos).not.toHaveBeenCalled();
  });

  it("filtrar por idioma en vídeos navega con el filtro", async () => {
    const user = userEvent.setup();
    renderApp({ params: { tab: "videos" } });

    await user.selectOptions(screen.getByLabelText("explore.filterLanguage"), "en");

    expect(routerReplace).toHaveBeenCalledWith({
      pathname: "/explorar",
      query: { tab: "videos", language: "en" },
    });
    expect(mockedSearchVideos).not.toHaveBeenCalled();
  });

  it("los chips de filtros activos se muestran y quitar uno navega sin él", async () => {
    const user = userEvent.setup();
    renderApp({ params: { tab: "profiles", role: "emprendedor" } });

    expect(screen.getByRole("button", { name: /types\.emprendedor/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /types\.emprendedor/ }));

    expect(routerReplace).toHaveBeenCalledWith({
      pathname: "/explorar",
      query: { tab: "profiles" },
    });
  });

  it("Ver más en una sección de Todo navega a esa pestaña", async () => {
    const user = userEvent.setup();
    renderApp({
      initial: initialData({ videos: { ok: true, items: [video("v1")], nextCursor: null } }),
    });

    await user.click(screen.getByText("explore.seeMore"));

    expect(routerReplace).toHaveBeenCalledWith({
      pathname: "/explorar",
      query: { tab: "videos" },
    });
  });
});

describe("ExploreApp — cargar más", () => {
  it("cargar más pide la siguiente página con el cursor y la añade sin duplicar", async () => {
    const user = userEvent.setup();
    mockedSearchVideos.mockResolvedValueOnce({
      ok: true,
      page: { items: [video("v1"), video("v2")], nextCursor: null },
    });
    renderApp({
      params: { tab: "videos" },
      initial: initialData({ videos: { ok: true, items: [video("v1")], nextCursor: "cursor-1" } }),
    });

    await user.click(screen.getByText("explore.loadMore"));

    expect(await screen.findByText("Vídeo v2")).toBeInTheDocument();
    expect(screen.getAllByText("Vídeo v1")).toHaveLength(1);
    expect(mockedSearchVideos.mock.calls[0][1]).toMatchObject({ cursor: "cursor-1" });
  });

  it("desaparece cargar más sin nextCursor", () => {
    renderApp({
      params: { tab: "videos" },
      initial: initialData({ videos: { ok: true, items: [video("v1")], nextCursor: null } }),
    });

    expect(screen.queryByText("explore.loadMore")).not.toBeInTheDocument();
  });

  it("un fallo al cargar la siguiente página conserva los items ya cargados", async () => {
    const user = userEvent.setup();
    mockedSearchVideos.mockResolvedValueOnce({ ok: false, error: "boom" });
    renderApp({
      params: { tab: "videos" },
      initial: initialData({ videos: { ok: true, items: [video("v1")], nextCursor: "cursor-1" } }),
    });

    await user.click(screen.getByText("explore.loadMore"));

    expect(await screen.findByText("explore.loadMoreError")).toBeInTheDocument();
    expect(screen.getByText("Vídeo v1")).toBeInTheDocument();
    expect(screen.getByText("explore.loadMore")).toBeInTheDocument();
  });
});

describe("ExploreApp — búsqueda", () => {
  it("enviar el formulario navega a /explorar con la query", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText("explore.search"), "inteligencia{enter}");

    expect(routerReplace).toHaveBeenCalledWith({
      pathname: "/explorar",
      query: { q: "inteligencia" },
    });
  });

  it("una búsqueda vacía navega a /explorar sin query", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText("explore.search"), "   {enter}");

    expect(routerReplace).toHaveBeenCalledWith("/explorar");
  });

  it("el botón de limpiar borra la búsqueda", async () => {
    const user = userEvent.setup();
    renderApp({ params: { q: "hola" } });

    await user.click(screen.getByLabelText("explore.clearSearch"));

    expect(routerReplace).toHaveBeenCalledWith("/explorar");
  });
});
