import { getTranslations } from "next-intl/server";
import { ChevronRight, MapPin, Rocket } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { OrganizationWithOwner } from "@/organizations/data";

type OrganizationRowProps = {
  organization: OrganizationWithOwner;
  projectCount?: number;
};

export async function OrganizationRow({
  organization,
  projectCount,
}: OrganizationRowProps) {
  const industries = await getTranslations("industries");
  const t = await getTranslations("feed");

  return (
    <Link
      href={`/organizaciones/${organization.slug}`}
      className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <Avatar name={organization.name} src={organization.logo_url} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold">{organization.name}</h3>
          {organization.headline && (
            <span className="hidden truncate text-sm text-muted-foreground lg:inline">
              {organization.headline}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {organization.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {organization.location}
            </span>
          )}
          {typeof projectCount === "number" && (
            <span className="inline-flex items-center gap-1">
              <Rocket className="size-3.5" aria-hidden="true" />
              {t("projectCount", { count: projectCount })}
            </span>
          )}
          {organization.industries.slice(0, 2).map((industry) => (
            <Badge key={industry} className="border-border bg-muted text-muted-foreground">
              {industries(industry as Parameters<typeof industries>[0])}
            </Badge>
          ))}
        </div>
      </div>

      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
