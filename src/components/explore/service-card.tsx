"use client";

import { useTranslations } from "next-intl";
import { Globe, MapPin, Store } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { SearchService } from "@/search/types";

type ServiceCardProps = {
  service: SearchService;
};

// Tarjeta de un servicio en Explorar y /servicios. Enlaza al detalle
// /servicios/[id]. Categoría y modo son keys de `services`; el precio es solo
// señal informativa (sin pagos) y se formatea con servicePricing.
export function ServiceCard({ service }: ServiceCardProps) {
  const t = useTranslations("services");
  const pricing = useTranslations("servicePricing");

  const priceLabel = formatPriceLabel(service, pricing);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Store className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            <Link href={`/servicios/${service.id}`} className="focus-visible:outline-none">
              {service.title}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">{t(`categories.${service.category}` as never)}</p>
        </div>
        {priceLabel && (
          <p className="ml-auto shrink-0 text-sm font-semibold text-primary">{priceLabel}</p>
        )}
      </div>

      {service.description && (
        <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{service.description}</p>
      )}

      {service.provider && (
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Avatar
            name={service.provider.fullName ?? service.provider.username}
            src={service.provider.avatarUrl}
            size="sm"
          />
          <div className="min-w-0 text-xs">
            <p className="truncate font-medium">
              <Link
                href={`/perfil/${service.provider.username ?? service.provider.id}`}
                className="focus-visible:outline-none"
              >
                {service.provider.fullName ?? `@${service.provider.username ?? ""}`}
              </Link>
            </p>
            {service.provider.headline && (
              <p className="truncate text-muted-foreground">{service.provider.headline}</p>
            )}
          </div>
          <Badge className="ml-auto shrink-0 border-border bg-muted text-muted-foreground">
            {service.deliveryMode === "remote" ? (
              <>
                <Globe className="mr-1 inline size-3 align-[-1px]" aria-hidden="true" />
                {t(`deliveryModes.${service.deliveryMode}` as never)}
              </>
            ) : (
              <>
                <MapPin className="mr-1 inline size-3 align-[-1px]" aria-hidden="true" />
                {t(`deliveryModes.${service.deliveryMode}` as never)}
              </>
            )}
          </Badge>
        </div>
      )}
    </article>
  );
}

// Etiqueta compacta del precio según pricing_type. Los importes llegan como
// number desde la RPC; se muestran sin decimales si son enteros.
export function formatPriceLabel(
  service: Pick<
    SearchService,
    "pricingType" | "priceAmount" | "priceMin" | "priceMax" | "currency"
  >,
  pricing: ReturnType<typeof useTranslations>,
): string {
  const formatAmount = (value: number) =>
    `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value)}${
      service.currency ? ` ${service.currency}` : ""
    }`;

  if (service.pricingType === "free") return pricing("free");
  if (service.pricingType === "negotiable") return pricing("negotiable");
  if (service.pricingType === "fixed") {
    return service.priceAmount !== null ? formatAmount(service.priceAmount) : "";
  }
  if (service.pricingType === "hourly") {
    return service.priceAmount !== null
      ? `${formatAmount(service.priceAmount)}${pricing("perHourSuffix")}`
      : "";
  }
  // range
  if (service.priceMin !== null && service.priceMax !== null) {
    return `${formatAmount(service.priceMin)} – ${formatAmount(service.priceMax)}`;
  }
  return "";
}
