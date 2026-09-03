// Tests de la UI dependiente del estado de autenticación (la fuente de verdad
// es server-side `getCurrentUser()`). Verifican que la superficie visible
// cambia sin depender de recarga manual:
//   - anónimo        → botones de visitante (Iniciar sesión / Crear cuenta)
//   - autenticado    → UI de usuario (Panel, Editar perfil, Cerrar sesión)
//   - CTA de la home → "Crear cuenta gratis" SOLO si no hay sesión
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/[locale]/page";

// Traducciones reales (Español) para aserciones legibles.
const ES: Record<string, string> = {
  "nav.signIn": "Iniciar sesión",
  "nav.createAccount": "Crear cuenta",
  "nav.panel": "Panel",
  "nav.editProfile": "Editar perfil",
  "nav.signOut": "Cerrar sesión",
  "nav.projects": "Proyectos",
  "nav.organizations": "Organizaciones",
  "nav.myVideos": "Mis videos",
  "nav.language": "Idioma",
  "nav.adminVideos": "Videos admin",
  "nav.adminOpportunities": "Oportunidades admin",
  "nav.adminServices": "Servicios admin",
  "nav.adminReports": "Reportes admin",
  "home.intro.publishCta": "Publicar proyecto",
  "home.intro.createAccount": "Crear cuenta gratis",
  "home.intro.exploreCta": "Explorar proyectos",
};

const translate = (ns: string, key: string) => ES[`${ns}.${key}`] ?? `${ns}.${key}`;

vi.mock("next-intl/server", () => ({
  getTranslations: (ns: string) => (key: string) => translate(ns, key),
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => translate(ns, key),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, className, children }: { href: unknown; className?: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/shared/locale-switcher", () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

vi.mock("@/components/shared/logo", () => ({
  Logo: () => <span data-testid="logo">Logo</span>,
}));

vi.mock("@/actions/auth", () => ({
  signOutAction: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
  getSupabasePublishableKey: () => "anon-key",
}));

vi.mock("@/i18n/metadata", () => ({
  pageMetadataTitle: vi.fn(async () => "Ideora"),
}));

vi.mock("@/auth/session", () => ({
  getCurrentUser: vi.fn(async () => ({ supabase: {} as never, user: null })),
}));

// Base UI (Button) no se renderiza fiablemente en jsdom; se sustituye por un
// <button> plano para poder asertar la superficie autenticada de SignedInNav.
vi.mock("@/components/ui/button", () => ({
  buttonVariants: () => "btn",
  Button: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <button data-slot="button" {...props}>
      {children}
    </button>
  ),
}));

// --- mocks para HomePage ---
vi.mock("@/components/navigation/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/feed/feed-tabs", () => ({
  FeedTabs: () => <div data-testid="feed-tabs" />,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/feed/home", () => ({
  loadHomeFeed: vi.fn(async () => ({ forYou: { ok: true, items: [], nextCursor: null }, following: null })),
}));

// --- importación diferida tras mocks ---
import { getCurrentUser } from "@/auth/session";
import { AuthActions } from "@/components/shared/auth-actions";
import { SignedInNav } from "@/components/shared/signed-in-nav";

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

afterEach(() => {
  cleanup();
  mockedGetCurrentUser.mockReset();
});

function stubSession(user: boolean) {
  mockedGetCurrentUser.mockResolvedValue({
    supabase: {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      rpc: async () => ({ data: 0, error: null }),
      auth: { getClaims: async () => ({ data: null, error: null }) },
    } as never,
    user: user ? { id: "u1" } : null,
  });
}

describe("UI de visita (anónimo)", () => {
  it("AuthActions muestra Iniciar sesión y Crear cuenta", async () => {
    stubSession(false);
    render(await AuthActions());

    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
      "href",
      "/iniciar-sesion",
    );
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute(
      "href",
      "/registrarse",
    );
  });
});

describe("UI de usuario (autenticado)", () => {
  it("SignedInNav muestra Panel, Editar perfil y Cerrar sesión", async () => {
    stubSession(true);
    render(await SignedInNav({}));

    expect(screen.getByRole("link", { name: "Panel" })).toHaveAttribute("href", "/panel");
    expect(screen.getByRole("link", { name: "Editar perfil" })).toHaveAttribute(
      "href",
      "/configuracion/perfil",
    );
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    // No aparecen botones de visita con sesión iniciada.
    expect(screen.queryByRole("link", { name: "Iniciar sesión" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Crear cuenta" })).not.toBeInTheDocument();
  });
});

describe("HomePage — CTA de la home dependiente de auth", () => {
  it("anónimo muestra el CTA de registro 'Crear cuenta gratis'", async () => {
    stubSession(false);
    render(await HomePage());

    expect(screen.getByRole("link", { name: "Crear cuenta gratis" })).toHaveAttribute(
      "href",
      "/registrarse",
    );
    expect(screen.getByTestId("feed-tabs")).toBeInTheDocument();
  });

  it("autenticado muestra 'Publicar proyecto' y NO el CTA 'Crear cuenta gratis'", async () => {
    stubSession(true);
    render(await HomePage());

    expect(screen.getByRole("link", { name: "Publicar proyecto" })).toHaveAttribute(
      "href",
      "/proyectos/nuevo",
    );
    expect(screen.queryByRole("link", { name: "Crear cuenta gratis" })).not.toBeInTheDocument();
  });
});
