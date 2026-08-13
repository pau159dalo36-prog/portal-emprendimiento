"use client";

import { useTranslations } from "next-intl";
import { MapPin, Users } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { hashCode, PROJECT_FALLBACK_GRADIENTS } from "@/lib/project-visuals";
import type { SearchOrganization } from "@/search/types";

type OrganizationCardProps = {
  organization: SearchOrganization;
};

// Tarjeta de una organización en el hub Explorar.
export function OrganizationCard({ organization }: OrganizationCardProps) {
  const t = useTranslations("explore");
  const industries = useTranslations("industries");

  const ownerName =
    organization.owner?.fullName ?? organization.owner?.username ?? t("anonymous");
  const gradient =
    PROJECT_FALLBACK_GRADIENTS[hashCode(organization.id) % PROJECT_FALLBACK_GRADIENTS.length];

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={organization.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}>
              <Users className="size-5 text-white/50" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            <Link
              href={`/organizaciones/${organization.slug}`}
              className="focus-visible:outline-none"
            >
              {organization.name}
            </Link>
          </h3>
          {organization.headline && (
            <p className="truncate text-xs text-muted-foreground">{organization.headline}</p>
          )}
        </div>
      </div>

      {organization.industries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {organization.industries.map((industry) => (
            <Badge key={industry} className="border-border bg-muted text-muted-foreground">
              {industries(industry)}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
        <Avatar name={organization.owner?.fullName ?? null} src={organization.owner?.avatarUrl} size="sm" />
        <span className="min-w-0 truncate">{t("memberOf", { name: ownerName })}</span>
        {organization.location && (
          <span className="ml-auto flex shrink-0 items-center gap-1 truncate">
            <MapPin className="size-3.5" aria-hidden="true" />
            <span className="truncate">{organization.location}</span>
          </span>
        )}
      </div>
    </article>
  );
}
