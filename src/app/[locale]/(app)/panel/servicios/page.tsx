import { getLocale, getTranslations } from "next-intl/server";
import { Eye, Pencil, Send, Store } from "lucide-react";

import { requireUser } from "@/auth/session";
import {
  changeServiceStatusAction,
} from "@/actions/service";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import {
  SERVICE_STATUS_TRANSITIONS,
  SERVICE_TITLE_MAX_LENGTH,
  type ServiceStatus,
} from "@/services/constants";
import { listOwnServices } from "@/services/data";

const VISIBILITY_LABELS: Record<string, string> = {
  public: "public",
  registered_users: "registeredUsers",
};

async function ServicePanelCard({ service }: { service: Awaited<ReturnType<typeof listOwnServices>>[number] }) {
  const t = await getTranslations("services");
  const form = await getTranslations("serviceForm");
  const statuses = await getTranslations("serviceStatuses");
  const moderation = await getTranslations("moderationStatuses");
  const locale = await getLocale();

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const status = service.status as ServiceStatus;
  const allowed = SERVICE_STATUS_TRANSITIONS[status] ?? [];
  const isModerationPending =
    service.moderation_status === "unreviewed" || service.moderation_status === "flagged";

  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 max-w-full truncate text-base font-semibold sm:max-w-md">
            {service.title.length > SERVICE_TITLE_MAX_LENGTH
              ? service.title.slice(0, SERVICE_TITLE_MAX_LENGTH)
              : service.title}
          </h2>
          <Badge className="border-primary/30 bg-primary/10 text-primary">
            {t(`categories.${service.category}` as never)}
          </Badge>
          <Badge className="border-border bg-muted text-muted-foreground">
            {statuses(status as Parameters<typeof statuses>[0])}
          </Badge>
          {isModerationPending && (
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {moderation(service.moderation_status as Parameters<typeof moderation>[0])}
            </Badge>
          )}
          <Badge className="border-border bg-muted text-muted-foreground">
            {form(`visibility.${VISIBILITY_LABELS[service.visibility] ?? service.visibility}`)}
          </Badge>
        </div>

        <p className="line-clamp-1 text-sm text-muted-foreground">
          {t(`pricingTypes.${service.pricing_type}` as never)}
        </p>

        {service.moderation_reason && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {t("moderationReason", { reason: service.moderation_reason })}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {t("createdOn", { date: dateFormatter.format(new Date(service.created_at)) })}
          {service.published_at
            ? ` · ${t("publishedAtLabel", {
                date: dateFormatter.format(new Date(service.published_at)),
              })}`
            : null}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {(status === "published" || status === "paused") && (
            <Link
              href={`/servicios/${service.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Eye aria-hidden="true" />
              {t("view")}
            </Link>
          )}
          {status !== "archived" && (
            <Link
              href={`/servicios/${service.id}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil aria-hidden="true" />
              {t("edit")}
            </Link>
          )}

          {allowed.includes("published") && (
            <form action={changeServiceStatusAction}>
              <input type="hidden" name="service_id" value={service.id} />
              <input type="hidden" name="status" value="published" />
              <button type="submit" className={buttonVariants({ size: "sm" })}>
                <Send aria-hidden="true" />
                {status === "paused" ? form("resumeButton") : form("publishButton")}
              </button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export async function generateMetadata() {
  return { title: await pageMetadataTitle("panelServices") };
}

// Mis servicios: todos los estados del ciclo (draft/published/paused/archived).
export default async function PanelServicesPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("services");

  const services = await listOwnServices(supabase, user.id);
  const active = services.filter((s) => s.status !== "archived");
  const archived = services.filter((s) => s.status === "archived");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("panelTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("panelDescription")}</p>
        </div>
        <Link href="/publicar/servicio" className={buttonVariants()}>
          <Store aria-hidden="true" />
          {t("newTitle")}
        </Link>
      </div>

      {services.length === 0 ? (
        <section className="grid gap-6 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Store className="size-7" aria-hidden="true" />
          </div>
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold">{t("emptyPanelTitle")}</h2>
            <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
              {t("emptyPanelDescription")}
            </p>
          </div>
          <div className="flex justify-center">
            <Link href="/publicar/servicio" className={buttonVariants()}>
              {t("publishCta")}
            </Link>
          </div>
        </section>
      ) : (
        <div className="grid gap-8">
          {active.length > 0 && (
            <section className="grid gap-3">
              <div className="grid gap-1">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("panelActiveSection")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {active.length}{" "}
                  {active.length === 1 ? t("panelItem") : t("panelItems")}
                </p>
              </div>
              <div className="grid gap-3">
                {active.map((service) => (
                  <ServicePanelCard key={service.id} service={service} />
                ))}
              </div>
            </section>
          )}
          {archived.length > 0 && (
            <section className="grid gap-3">
              <div className="grid gap-1">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("panelArchivedSection")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {archived.length}{" "}
                  {archived.length === 1 ? t("panelItem") : t("panelItems")}
                </p>
              </div>
              <div className="grid gap-3">
                {archived.map((service) => (
                  <ServicePanelCard key={service.id} service={service} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
