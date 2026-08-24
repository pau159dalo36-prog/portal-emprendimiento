import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { FileText } from "lucide-react";

import { withdrawApplicationAction } from "@/actions/application";
import type { ApplicationFilter, ApplicationStatus } from "@/applications/config";
import { APPLICATION_FILTERS } from "@/applications/config";
import { listMyApplications } from "@/applications/data";
import { canWithdraw } from "@/applications/permissions";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/auth/session";
import { pageMetadataTitle } from "@/i18n/metadata";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("panelApplications") };
}

function isApplicationFilterValue(value: string | undefined): value is ApplicationFilter {
  return (APPLICATION_FILTERS as readonly string[]).includes(value ?? "");
}

export default async function PanelApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("applications");
  const typesT = await getTranslations("opportunityTypes");
  const locale = await getLocale();

  const { status: rawStatus } = await searchParams;
  const filter: ApplicationFilter = isApplicationFilterValue(rawStatus) ? rawStatus : "all";

  const all = await listMyApplications(supabase, user.id);
  const applications =
    filter === "all" ? all : all.filter((row) => row.status === filter);

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <nav aria-label={t("filtersLabel")} className="flex flex-wrap items-center gap-2">
        {APPLICATION_FILTERS.map((key) => (
          <Link
            key={key}
            href={key === "all" ? "/panel/candidaturas" : `/panel/candidaturas?status=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: filter === key ? "default" : "outline", size: "sm" }),
            )}
          >
            {t(`filters.${key}`)}
          </Link>
        ))}
      </nav>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
            <Link
              href="/oportunidades"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("browseOpportunities")}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {applications.map(({ opportunity, ...row }) => (
            <Card key={row.id}>
              <CardContent className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {opportunity ? (
                    <Link
                      href={`/oportunidades/${opportunity.id}`}
                      className="min-w-0 truncate text-base font-semibold hover:underline"
                    >
                      {opportunity.title}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate text-base font-semibold text-muted-foreground">
                      {t("opportunityUnavailable")}
                    </span>
                  )}
                  <ApplicationStatusBadge status={row.status} />
                </div>

                {opportunity && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge className="border-border bg-muted text-muted-foreground">
                      {typesT(opportunity.opportunity_type as Parameters<typeof typesT>[0])}
                    </Badge>
                    {[opportunity.city, opportunity.country].filter(Boolean).join(", ")}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {t("appliedOn", { date: dateFormatter.format(new Date(row.created_at)) })}
                </p>

                {row.message && (
                  <p className="line-clamp-2 rounded-lg border border-border/60 bg-muted/50 p-2 text-sm text-muted-foreground">
                    {row.message}
                  </p>
                )}

                {canWithdraw(user.id, row.applicant_id, row.status as ApplicationStatus) && (
                  <form action={withdrawApplicationAction}>
                    <input type="hidden" name="application_id" value={row.id} />
                    <SubmitButton variant="ghost" size="sm">
                      {t("withdraw")}
                    </SubmitButton>
                  </form>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
