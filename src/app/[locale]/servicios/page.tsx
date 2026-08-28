import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/auth/session";
import { ServiceMarket } from "@/components/services/service-market";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { searchServices } from "@/search/data";
import { marketParamsSchema } from "@/search/schemas";

type ServicesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// SEO: una query arbitraria (?q=) genera contenido no curiable → noindex.
export async function generateMetadata({
  searchParams,
}: ServicesPageProps): Promise<Metadata> {
  const params = marketParamsSchema.parse(await searchParams);
  return {
    title: await pageMetadataTitle("services"),
    robots: params.q ? { index: false, follow: true } : undefined,
  };
}

// Mercado de servicios. Primera página server-side con la misma RPC que el
// Explorar (search_services, SECURITY DEFINER, keyset); "Cargar más" en el
// cliente con cursor. Filtros y query en el query string (Zod, nunca 500).
export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const params = marketParamsSchema.parse(await searchParams);
  const { supabase } = await getCurrentUser();
  const t = await getTranslations("services");

  const initial = await searchServices(supabase, {
    query: params.q,
    sort: params.sort,
    category: params.category || null,
    deliveryMode: params.deliveryMode || null,
    pricingType: params.pricingType || null,
  });

  return (
    <div className="grid gap-6">
      <section className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t("marketTitle")}</h1>
          <Link href="/publicar/servicio" className={buttonVariants({ size: "sm" })}>
            {t("publishCta")}
          </Link>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("marketDescription")}
        </p>
      </section>

      <ServiceMarket
        key={JSON.stringify(params)}
        initialParams={params}
        initial={initial}
      />
    </div>
  );
}
