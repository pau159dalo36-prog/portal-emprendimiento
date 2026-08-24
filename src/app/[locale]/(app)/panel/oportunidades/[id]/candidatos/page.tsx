import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";

import type { ApplicationStatus } from "@/applications/config";
import { getApplicationCounts, listOpportunityApplications } from "@/applications/data";
import { CandidateActions } from "@/components/applications/candidate-actions";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { StartConversationButton } from "@/components/messaging/start-conversation-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/auth/session";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link as I18nLink } from "@/i18n/navigation";
import { getOpportunityById } from "@/opportunities/data";

type CandidatesPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata() {
  return { title: await pageMetadataTitle("panelCandidates") };
}

export default async function OpportunityCandidatesPage({ params }: CandidatesPageProps) {
  const { id, locale } = await params;
  const { supabase } = await requireUser();
  const t = await getTranslations("candidates");
  const typesT = await getTranslations("opportunityTypes");

  // RLS: una oportunidad invisible para el llamador ⇒ notFound (fail-closed).
  const opportunity = await getOpportunityById(supabase, id);
  if (!opportunity) {
    notFound();
  }

  // Outsiders obtienen cero filas por RLS; la página muestra vacío, no error.
  const [applications, counts] = await Promise.all([
    listOpportunityApplications(supabase, opportunity.id),
    getApplicationCounts(supabase, [opportunity.id]),
  ]);
  const count = counts.get(opportunity.id) ?? { total: applications.length, acceptedCount: 0 };

  const isOneDay = opportunity.opportunity_type === "one_day_shift";
  const slotsTotal = opportunity.slots_total ?? null;

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <I18nLink
          href="/panel/oportunidades"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("backToPanel")}
        </I18nLink>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/oportunidades/${opportunity.id}`} className="font-medium text-primary hover:underline">
            {opportunity.title}
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge className="border-border bg-muted text-muted-foreground">
            {typesT(opportunity.opportunity_type as Parameters<typeof typesT>[0])}
          </Badge>
          {isOneDay && slotsTotal != null && (
            <span data-testid="shift-slots">
              {t("slotsLine", { accepted: count.acceptedCount, total: slotsTotal })}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("totalApplications", { count: count.total })}
        </p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {applications.map((application) => {
            const applicantName =
              application.applicant?.full_name ?? application.applicant?.username ?? t("anonymous");
            return (
              <Card key={application.id}>
                <CardContent className="grid gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={application.applicant?.full_name}
                        src={application.applicant?.avatar_url}
                        size="md"
                      />
                      <div className="min-w-0 grid gap-0.5">
                        {application.applicant?.username ? (
                          <I18nLink
                            href={`/perfil/${application.applicant.username}`}
                            className="truncate text-base font-semibold hover:underline"
                          >
                            {applicantName}
                          </I18nLink>
                        ) : (
                          <span className="truncate text-base font-semibold">{applicantName}</span>
                        )}
                        <span className="truncate text-xs text-muted-foreground">
                          {[application.applicant?.headline, application.applicant?.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    </div>
                    <ApplicationStatusBadge status={application.status} />
                  </div>

                  {application.message && (
                    <blockquote className="rounded-lg border border-border/60 bg-muted/50 p-2 text-sm text-muted-foreground">
                      {application.message}
                    </blockquote>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {t("appliedOn", {
                      date: dateFormatter.format(new Date(application.created_at)),
                    })}
                  </p>

                  <CandidateActions
                    applicationId={application.id}
                    status={application.status as ApplicationStatus}
                  />

                  {application.status === "accepted" && application.applicant?.id && (
                    <StartConversationButton
                      targetProfileId={application.applicant.id}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
