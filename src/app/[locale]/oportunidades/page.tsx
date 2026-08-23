import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/auth/session";
import { OpportunityMarket } from "@/components/opportunities/opportunity-market";
import { pageMetadataTitle } from "@/i18n/metadata";
import { searchOpportunities } from "@/search/data";
import { marketParamsSchema } from "@/search/schemas";

type OpportunitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// SEO: una query arbitraria (?q=) genera contenido no curiable → noindex.
// Sin query es un hub estable y curiable.
export async function generateMetadata({
  searchParams,
}: OpportunitiesPageProps): Promise<Metadata> {
  const params = marketParamsSchema.parse(await searchParams);
  return {
    title: await pageMetadataTitle("opportunities"),
    robots: params.q ? { index: false, follow: true } : undefined,
  };
}

// Mercado de oportunidades. La primera página se carga en el servidor con la
// misma RPC que el Explorar (search_opportunities, SECURITY DEFINER, keyset);
// la UI pide las siguientes con su cursor. Filtros y query en el query string
// (validados con Zod, fallback seguro, nunca 500).
export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = marketParamsSchema.parse(await searchParams);
  const { supabase } = await getCurrentUser();
  const t = await getTranslations("opportunity");

  const initial = await searchOpportunities(supabase, {
    query: params.q,
    sort: params.sort,
    opportunityType: params.opportunityType || null,
    industry: params.industry || null,
    workMode: params.workMode || null,
    experience: params.experience || null,
    firstJob: params.firstJob === "true" ? true : null,
    date: params.date || null,
  });

  return (
    <div className="grid gap-6">
      <section className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
      </section>

      <OpportunityMarket
        key={JSON.stringify(params)}
        initialParams={params}
        initial={initial}
      />
    </div>
  );
}
