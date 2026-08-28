import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SaveButton } from "@/components/interactions/save-button";
import { StartConversationButton } from "@/components/messaging/start-conversation-button";
import { ServiceStatusControls } from "@/components/services/service-status-controls";
import { brand } from "@/config/brand";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { isSaved } from "@/interactions/saves";
import type { ServiceStatus } from "@/services/constants";
import { getServiceById, type ServiceWithProvider } from "@/services/data";

type ServiceDetailPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

function formatPrice(service: ServiceWithProvider, locale: string): string | null {
  const formatter = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES", {
    style: "currency",
    currency: service.currency ?? "USD",
    maximumFractionDigits: 2,
  });
  const withCurrency = service.currency !== null;
  if (service.pricing_type === "free") return null;
  if (service.pricing_type === "negotiable") return null;
  if (service.pricing_type === "fixed" || service.pricing_type === "hourly") {
    if (service.price_amount === null) return null;
    const amount = withCurrency
      ? formatter.format(Number(service.price_amount))
      : String(service.price_amount);
    return service.pricing_type === "hourly" ? `${amount} / h` : amount;
  }
  if (service.price_min !== null && service.price_max !== null) {
    if (withCurrency) {
      return `${formatter.format(Number(service.price_min))} – ${formatter.format(Number(service.price_max))}`;
    }
    return `${service.price_min} – ${service.price_max}`;
  }
  return null;
}

export async function generateMetadata({
  params,
}: ServiceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await getCurrentUser();
  const service = await getServiceById(supabase, id);

  if (!service) {
    return { title: await pageMetadataTitle("services") };
  }

  return {
    title: `${service.title} — ${brand.name}`,
    description: service.description.slice(0, 160),
  };
}

// Detalle de un servicio. La RLS decide quién lo ve (público distribuible,
// propio o registered_users); si no llega fila → 404. CTA de contacto
// reutilizando la mensajería 1:1 de FASE 10 (get_or_create_dm): sin chats
// paralelos ni datos de contacto expuestos.
export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { id, locale } = await params;
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("services");
  const statuses = await getTranslations("serviceStatuses");
  const moderation = await getTranslations("moderationStatuses");

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const service = await getServiceById(supabase, id);
  if (!service) {
    notFound();
  }

  const isOwner = user?.id === service.provider_id;

  // Guardar servicio (FASE 9 extendida): solo quien no es el proveedor; la RLS
  // valida que siga siendo públicamente distribuible al guardar.
  const savedService =
    !!user && !isOwner
      ? await isSaved(supabase, user.id, "service", service.id)
      : false;

  const price = formatPrice(service, locale);
  const providerName =
    service.provider?.full_name ?? service.provider?.username ?? t("anonymous");

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{service.title}</h1>
          {user && !isOwner && (
            <SaveButton targetId={service.id} targetType="service" saved={savedService} />
          )}
          <Badge className="border-primary/30 bg-primary/10 text-primary">
            {t(`categories.${service.category}` as never)}
          </Badge>
          {isOwner && (
            <>
              <Badge className="border-border bg-muted text-muted-foreground">
                {statuses(service.status as Parameters<typeof statuses>[0])}
              </Badge>
              {(service.moderation_status === "rejected" ||
                service.moderation_status === "flagged") && (
                <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {moderation(service.moderation_status as Parameters<typeof moderation>[0])}
                </Badge>
              )}
            </>
          )}
        </div>

        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {service.description}
        </p>

        {isOwner && service.moderation_reason && (
          <p className="text-sm text-muted-foreground">
            {t("moderationReason", { reason: service.moderation_reason })}
          </p>
        )}

        <dl className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("deliveryModeLabel")}</dt>
            <dd>{t(`deliveryModes.${service.delivery_mode}` as never)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("pricingTypeLabel")}</dt>
            <dd className="font-medium">
              {price
                ? `${t(`pricingTypes.${service.pricing_type}` as never)} · ${price}`
                : t(`pricingTypes.${service.pricing_type}` as never)}
            </dd>
          </div>
        </dl>

        <div className="grid gap-4 rounded-2xl border border-border/60 bg-card p-4 sm:flex sm:items-center sm:gap-4">
          {service.provider && (
            <Link
              href={`/perfil/${service.provider.username ?? ""}`}
              className={`inline-flex items-center gap-3 hover:underline ${
                !service.provider.username ? "pointer-events-none" : ""
              }`}
            >
              <Avatar
                name={service.provider.full_name}
                src={service.provider.avatar_url}
                size="md"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{providerName}</span>
                {service.provider.headline && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {service.provider.headline}
                  </span>
                )}
              </span>
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {user && !isOwner && service.provider && (
              <StartConversationButton targetProfileId={service.provider.id} />
            )}
            {!user && service.provider && (
              <Link href="/iniciar-sesion" className={buttonVariants({ variant: "outline", size: "sm" })}>
                {t("contactCta")}
              </Link>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("publishedAtLabel", {
            date: dateFormatter.format(new Date(service.published_at ?? service.created_at)),
          })}
        </p>
      </div>

      {isOwner && (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/servicios/${service.id}/editar`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil aria-hidden="true" />
            {t("edit")}
          </Link>
          <ServiceStatusControls
            serviceId={service.id}
            status={service.status as ServiceStatus}
          />
        </div>
      )}
    </div>
  );
}
