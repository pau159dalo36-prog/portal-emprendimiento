import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/auth/session";
import { ExploreApp } from "@/components/explore/explore-app";
import { AppShell } from "@/components/navigation/app-shell";
import { pageMetadataTitle } from "@/i18n/metadata";
import { exploreParamsSchema } from "@/search/schemas";
import { loadExploreHome } from "@/search/home";

type ExplorePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// SEO: una query arbitraria (?q=) genera contenido no curiable → noindex
// (follow, para no cortar el rastro). Sin query la página es un hub estable.
export async function generateMetadata({
  searchParams,
}: ExplorePageProps): Promise<Metadata> {
  const params = exploreParamsSchema.parse(await searchParams);
  return {
    title: await pageMetadataTitle("explore"),
    robots: params.q ? { index: false, follow: true } : undefined,
  };
}

// Explorar = hub de descubrimiento con pestañas (Todo, perfiles, proyectos,
// organizaciones, vídeos). La query, la pestaña, el orden y los filtros llegan
// por query string y se validan con Zod (fallback seguro, nunca 500). La
// PRIMERA página de cada pestaña se carga en el servidor; las siguientes las
// pide la UI con su cursor. `key` = serialización de los params: fuerza un
// nuevo montaje al navegar (sin estados obsoletos entre búsquedas).
export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = exploreParamsSchema.parse(await searchParams);
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("explore");

  const initial = await loadExploreHome(supabase, params);

  return (
    <AppShell>
      <div className="grid gap-6">
        <section className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </section>

        <ExploreApp
          key={JSON.stringify(params)}
          initialParams={params}
          initial={initial}
          currentUserId={user?.id ?? null}
        />
      </div>
    </AppShell>
  );
}
