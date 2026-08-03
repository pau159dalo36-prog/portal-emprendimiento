import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { OrganizationWithOwner } from "@/organizations/data";

export async function OrgCard({ organization }: { organization: OrganizationWithOwner }) {
  const industries = await getTranslations("industries");

  return (
    <Link
      href={`/organizaciones/${organization.slug}`}
      className="group rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <Avatar name={organization.name} src={organization.logo_url} size="md" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{organization.name}</h2>
          {organization.headline && (
            <p className="truncate text-sm text-muted-foreground">
              {organization.headline}
            </p>
          )}
        </div>
      </div>

      {organization.industries.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {organization.industries.map((industry) => (
            <Badge key={industry} className="border-border bg-muted text-muted-foreground">
              {industries(industry as Parameters<typeof industries>[0])}
            </Badge>
          ))}
        </div>
      )}

      {organization.location && (
        <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" aria-hidden="true" />
          {organization.location}
        </div>
      )}
    </Link>
  );
}
