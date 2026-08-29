import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import {
  canManageOpportunity,
  getMyApplicationForOpportunity,
} from "@/applications/data";
import { ApplyButton } from "@/components/applications/apply-button";
import { ReportButton } from "@/components/reports/report-button";
import { isApplicationStatus } from "@/applications/config";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SaveButton } from "@/components/interactions/save-button";
import { brand } from "@/config/brand";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { getOpportunityById } from "@/opportunities/data";
import { isSaved } from "@/interactions/saves";
import {
  formatCompensation,
  getShiftDayLabelKey,
  isShiftPast,
  toLocationParts,
  withTranslatedPeriod,
} from "@/opportunities/format";

type OpportunityDetailPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({
  params,
}: OpportunityDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await getCurrentUser();
  const opportunity = await getOpportunityById(supabase, id);

  if (!opportunity) {
    return { title: await pageMetadataTitle("opportunities") };
  }

  return {
    title: `${opportunity.title} — ${brand.name}`,
    description: opportunity.description ?? undefined,
  };
}

export default async function OpportunityDetailPage({ params }: OpportunityDetailPageProps) {
  const { id, locale } = await params;
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("opportunity");
  const types = await getTranslations("opportunityTypes");
  const employmentTypes = await getTranslations("employmentTypes");
  const workModes = await getTranslations("workModes");
  const experienceLevels = await getTranslations("experienceLevels");
  const compensationTypes = await getTranslations("compensationTypes");
  const compensationPeriods = await getTranslations("compensationPeriods");
  const dates = await getTranslations("opportunityDates");
  const statuses = await getTranslations("opportunityStatuses");
  const moderation = await getTranslations("moderationStatuses");

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const opportunity = await getOpportunityById(supabase, id);
  if (!opportunity) {
    notFound();
  }

  const isOwner = user?.id === opportunity.creator_id;
  const isOneDay = opportunity.opportunity_type === "one_day_shift";
  const compensation = formatCompensation(
    {
      compensation_type: opportunity.compensation_type,
      compensation_min: opportunity.compensation_min,
      compensation_max: opportunity.compensation_max,
      currency: opportunity.currency,
      compensation_period: opportunity.compensation_period,
    },
    locale,
  );
  const location = toLocationParts({
    country: opportunity.country,
    region: opportunity.region,
    city: opportunity.city,
    location_text: opportunity.location_text,
  });
  const shiftDayKey = isOneDay ? getShiftDayLabelKey(opportunity.starts_at, new Date()) : null;
  const authorName = opportunity.owner?.full_name ?? opportunity.owner?.username ?? t("anonymous");

  // Guardar oportunidad (FASE 9): solo para quien no la creó; la RLS valida
  // que siga siendo públicamente distribuible al guardar.
  const savedOpportunity =
    !!user && !isOwner
      ? await isSaved(supabase, user.id, "opportunity", opportunity.id)
      : false;

  // Candidaturas (FASE 8): el CTA se muestra a autenticados que ni crean ni
  // gestionan la oportunidad; el estado real de la candidatura manda en UI.
  const [manages, myApplication] =
    user && !isOwner
      ? await Promise.all([
          canManageOpportunity(supabase, opportunity.id),
          getMyApplicationForOpportunity(supabase, user.id, opportunity.id),
        ])
      : [false, null];

  const isManager = user != null && manages;
  const shiftPast = isOneDay && opportunity.ends_at
    ? isShiftPast(opportunity.ends_at, new Date())
    : false;
  const applyEligibleUi = !isManager && opportunity.status === "published" && !shiftPast;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{opportunity.title}</h1>
          {user && !isOwner && (
            <>
              <SaveButton targetId={opportunity.id} targetType="opportunity" saved={savedOpportunity} />
              <ReportButton targetType="opportunity" targetId={opportunity.id} />
            </>
          )}
          <Badge className="border-primary/30 bg-primary/10 text-primary">
            {types(opportunity.opportunity_type as Parameters<typeof types>[0])}
          </Badge>
          {isOneDay && shiftDayKey && (
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {dates(shiftDayKey)}
            </Badge>
          )}
          {isOwner && (
            <Badge className="border-border bg-muted text-muted-foreground">
              {statuses(opportunity.status as Parameters<typeof statuses>[0])}
            </Badge>
          )}
          {isOwner &&
            (opportunity.moderation_status === "rejected" ||
              opportunity.moderation_status === "flagged") && (
              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {moderation(opportunity.moderation_status as Parameters<typeof moderation>[0])}
              </Badge>
            )}
        </div>

        {opportunity.description && (
          <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {opportunity.description}
          </p>
        )}

        {isOwner && opportunity.moderation_reason && (
          <p className="text-sm text-muted-foreground">
            {t("moderationReason", { reason: opportunity.moderation_reason })}
          </p>
        )}

        <dl className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4 text-sm">
          {opportunity.employment_type && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("employmentTypeLabel")}</dt>
              <dd>
                {employmentTypes(opportunity.employment_type as Parameters<typeof employmentTypes>[0])}
              </dd>
            </div>
          )}
          {opportunity.work_mode && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("workModeLabel")}</dt>
              <dd>{workModes(opportunity.work_mode as Parameters<typeof workModes>[0])}</dd>
            </div>
          )}
          {opportunity.experience_level && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("experienceLabel")}</dt>
              <dd>
                {experienceLevels(opportunity.experience_level as Parameters<typeof experienceLevels>[0])}
              </dd>
            </div>
          )}
          {opportunity.industry && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("industryLabel")}</dt>
              <dd>{opportunity.industry}</dd>
            </div>
          )}
          {compensation.value && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("compensationLabel")}</dt>
              <dd className="font-medium">
                {compensation.kind === "monetary"
                  ? withTranslatedPeriod(compensation, (period) => compensationPeriods(period))
                  : compensationTypes(compensation.kind)}
              </dd>
            </div>
          )}
          {location.length > 0 && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("locationLabel")}</dt>
              <dd>{location.join(", ")}</dd>
            </div>
          )}
          {isOneDay && opportunity.starts_at && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("startsAtLabel", { date: "" })}</dt>
              <dd>{dateFormatter.format(new Date(opportunity.starts_at))}</dd>
            </div>
          )}
          {isOneDay && opportunity.ends_at && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("endsAtLabel", { date: "" })}</dt>
              <dd>{dateFormatter.format(new Date(opportunity.ends_at))}</dd>
            </div>
          )}
          {opportunity.slots_total != null && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("slotsTotalLabel")}</dt>
              <dd>{opportunity.slots_total}</dd>
            </div>
          )}
          {!isOneDay && opportunity.closes_at && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("closesAtLabel", { date: "" })}</dt>
              <dd>{dateFormatter.format(new Date(opportunity.closes_at))}</dd>
            </div>
          )}
          {opportunity.is_first_job_friendly && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("firstJobFriendly")}</dt>
              <dd className="text-emerald-600 dark:text-emerald-400">✓</dd>
            </div>
          )}
          {opportunity.is_student_friendly && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("studentFriendly")}</dt>
              <dd className="text-emerald-600 dark:text-emerald-400">✓</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {opportunity.owner && (
            <Link
              href={`/perfil/${opportunity.owner.username ?? ""}`}
              className={`inline-flex items-center gap-2 hover:underline ${
                !opportunity.owner.username ? "pointer-events-none" : ""
              }`}
            >
              <Avatar name={opportunity.owner.full_name} src={opportunity.owner.avatar_url} size="sm" />
              {t("byAuthor", { name: authorName })}
            </Link>
          )}
          <span>
            {t("publishedAtLabel", {
              date: dateFormatter.format(new Date(opportunity.published_at ?? opportunity.created_at)),
            })}
          </span>
        </div>

        {opportunity.project && (
          <p className="text-sm">
            {t("inProject", { name: "" })}{" "}
            <Link
              href={`/proyectos/${opportunity.project.slug}`}
              className="font-medium text-primary hover:underline"
            >
              {opportunity.project.name}
            </Link>
          </p>
        )}

        {opportunity.organization && (
          <p className="text-sm">
            {t("inOrganization", { name: "" })}{" "}
            <Link
              href={`/organizaciones/${opportunity.organization.slug}`}
              className="font-medium text-primary hover:underline"
            >
              {opportunity.organization.name}
            </Link>
          </p>
        )}

        {isOneDay && opportunity.ends_at && isShiftPast(opportunity.ends_at, new Date()) && (
          <p className="text-sm text-muted-foreground">{t("shiftEnded")}</p>
        )}

        {user && !isOwner && !isManager && (myApplication || applyEligibleUi) && (
          <div className="grid gap-2">
            <ApplyButton
              opportunityId={opportunity.id}
              applicationId={myApplication?.id ?? null}
              initialStatus={
                myApplication?.status && isApplicationStatus(myApplication.status)
                  ? myApplication.status
                  : null
              }
              eligible={applyEligibleUi}
            />
          </div>
        )}
      </div>

      {isOwner && (
        <div>
          <Link
            href={`/oportunidades/${opportunity.id}/editar`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil aria-hidden="true" />
            {t("edit")}
          </Link>
        </div>
      )}
    </div>
  );
}
