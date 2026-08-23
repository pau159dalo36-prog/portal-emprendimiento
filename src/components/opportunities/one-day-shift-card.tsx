"use client";

import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Users } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import {
  formatCompensation,
  getShiftDayLabelKey,
  toLocationParts,
  withTranslatedPeriod,
} from "@/opportunities/format";
import type { SearchOpportunity } from "@/search/types";

type OneDayShiftCardProps = {
  opportunity: SearchOpportunity;
};

function toLocaleTime(iso: string | null, locale: string): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString(locale === "en" ? "en-US" : "es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocaleDate(iso: string | null, locale: string): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Tarjeta específica para trabajos de 1 día: destaca fecha, franja horaria y
// plazas. Los turnos pasados no son distribuibles (predicado de la BD), pero la
// tarjeta también lo comprueba en cliente para no mostrar turnos caducados.
export function OneDayShiftCard({ opportunity }: OneDayShiftCardProps) {
  const t = useTranslations("opportunity");
  const types = useTranslations("opportunityTypes");
  const dates = useTranslations("opportunityDates");
  const compensationTypes = useTranslations("compensationTypes");
  const compensationPeriods = useTranslations("compensationPeriods");
  const locale = useLocale();

  const date = toLocaleDate(opportunity.startsAt, locale);
  const startTime = toLocaleTime(opportunity.startsAt, locale);
  const endTime = toLocaleTime(opportunity.endsAt, locale);
  const dayKey = getShiftDayLabelKey(opportunity.startsAt, new Date());
  const compensation = formatCompensation(
    {
      compensation_type: opportunity.compensationType,
      compensation_min: opportunity.compensationMin,
      compensation_max: opportunity.compensationMax,
      currency: opportunity.currency,
      compensation_period: opportunity.compensationPeriod,
    },
    locale,
  );
  const location = toLocationParts({
    country: opportunity.country,
    region: opportunity.region,
    city: opportunity.city,
    location_text: opportunity.locationText,
  });
  const authorName = opportunity.owner?.fullName ?? opportunity.owner?.username ?? t("anonymous");

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
      <Link
        href={`/oportunidades/${opportunity.id}`}
        className="flex min-w-0 flex-1 flex-col gap-2 p-4 focus-visible:outline-none"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-primary/30 bg-primary/10 text-primary">
            {types("one_day_shift")}
          </Badge>
          {dayKey && (
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {dates(dayKey)}
            </Badge>
          )}
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          {opportunity.title}
        </h3>

        <div className="grid gap-1.5 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              {date}
              {startTime && endTime ? ` · ${startTime} – ${endTime}` : ""}
            </span>
          </p>
          {opportunity.slotsTotal != null && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4 shrink-0" aria-hidden="true" />
              {t("slotsLabel", { count: opportunity.slotsTotal })}
            </p>
          )}
          {compensation.value && (
            <p className="font-medium text-foreground">
              {compensation.kind === "monetary"
                ? withTranslatedPeriod(compensation, (period) => compensationPeriods(period))
                : compensationTypes(compensation.kind)}
            </p>
          )}
          {location.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">{location.join(", ")}</p>
          )}
        </div>
      </Link>

      <div className="flex items-center gap-2 border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
        <Avatar name={opportunity.owner?.fullName ?? null} src={opportunity.owner?.avatarUrl} size="sm" />
        <span className="min-w-0 truncate">{authorName}</span>
      </div>
    </article>
  );
}
