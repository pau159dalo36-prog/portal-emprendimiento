"use client";

import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import {
  formatCompensation,
  toLocationParts,
  withTranslatedPeriod,
} from "@/opportunities/format";
import type { SearchOpportunity } from "@/search/types";

type OpportunityCardProps = {
  opportunity: SearchOpportunity;
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const t = useTranslations("opportunity");
  const types = useTranslations("opportunityTypes");
  const workModes = useTranslations("workModes");
  const compensationTypes = useTranslations("compensationTypes");
  const compensationPeriods = useTranslations("compensationPeriods");
  const locale = useLocale();

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
  const projectName = opportunity.project?.name;
  const organizationName = opportunity.organization?.name;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
      <Link
        href={`/oportunidades/${opportunity.id}`}
        className="flex min-w-0 flex-1 flex-col gap-2 p-4 focus-visible:outline-none"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-primary/30 bg-primary/10 text-primary">
            {types(opportunity.opportunityType as Parameters<typeof types>[0])}
          </Badge>
          {opportunity.workMode && (
            <Badge className="border-border bg-muted text-muted-foreground">
              {workModes(opportunity.workMode as Parameters<typeof workModes>[0])}
            </Badge>
          )}
          {opportunity.isFirstJobFriendly && (
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {t("firstJobFriendly")}
            </Badge>
          )}
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          {opportunity.title}
        </h3>

        {opportunity.description && (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {opportunity.description}
          </p>
        )}

        <div className="mt-auto grid gap-1 pt-1.5 text-sm">
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
        {projectName && (
          <span className="ml-auto shrink-0 truncate text-muted-foreground/80">
            {t("inProject", { name: projectName })}
          </span>
        )}
        {organizationName && (
          <span className="ml-auto shrink-0 truncate text-muted-foreground/80">
            {t("inOrganization", { name: organizationName })}
          </span>
        )}
      </div>
    </article>
  );
}
