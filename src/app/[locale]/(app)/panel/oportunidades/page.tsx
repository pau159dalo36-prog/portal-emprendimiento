import { getLocale, getTranslations } from "next-intl/server";
import { Archive, CheckCircle2, Eye, Pencil, Send, XCircle } from "lucide-react";

import { requireUser } from "@/auth/session";
import { changeOpportunityStatusAction } from "@/actions/opportunity";
import { OpportunityEmptyState } from "@/components/opportunities/opportunity-empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { formatCompensation, toLocationParts } from "@/opportunities/format";
import { listOpportunitiesForUser } from "@/opportunities/data";
import {
  canCancelOpportunity,
  canCloseOpportunity,
  canEditOpportunity,
  canFillOpportunity,
  canPublishOpportunity,
  getPanelSection,
  PANEL_SECTION_ORDER,
  type PanelSectionKey,
} from "@/opportunities/panel";
import type { OpportunityWithDetails } from "@/opportunities/types";

const VISIBILITY_LABELS: Record<string, string> = {
  public: "public",
  registered_users: "registeredUsers",
  project_members: "projectMembers",
  private: "private",
  unlisted: "unlisted",
};

async function OpportunityPanelCard({
  opportunity,
}: {
  opportunity: OpportunityWithDetails;
}) {
  const t = await getTranslations("opportunity");
  const statuses = await getTranslations("opportunityStatuses");
  const moderation = await getTranslations("moderationStatuses");
  const form = await getTranslations("opportunityForm");
  const types = await getTranslations("opportunityTypes");
  const locale = await getLocale();

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isPublished = opportunity.status === "published";
  const isModerationPending =
    opportunity.moderation_status === "unreviewed" ||
    opportunity.moderation_status === "flagged";
  const isRejected = opportunity.moderation_status === "rejected";

  const publishable = canPublishOpportunity(opportunity);
  const editable = canEditOpportunity(opportunity);
  const closable = canCloseOpportunity(opportunity);
  const fillable = canFillOpportunity(opportunity);
  const cancellable = canCancelOpportunity(opportunity);

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

  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 truncate text-base font-semibold">{opportunity.title}</h2>
          <Badge className="border-primary/30 bg-primary/10 text-primary">
            {types(opportunity.opportunity_type as Parameters<typeof types>[0])}
          </Badge>
          <Badge className="border-border bg-muted text-muted-foreground">
            {statuses(opportunity.status as Parameters<typeof statuses>[0])}
          </Badge>
          {isModerationPending && (
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {moderation(opportunity.moderation_status as Parameters<typeof moderation>[0])}
            </Badge>
          )}
          {isRejected && (
            <Badge className="border-destructive/30 bg-destructive/10 text-destructive">
              {moderation("rejected")}
            </Badge>
          )}
          <Badge className="border-border bg-muted text-muted-foreground">
            {form(`visibility.${VISIBILITY_LABELS[opportunity.visibility] ?? opportunity.visibility}`)}
          </Badge>
        </div>

        <p className="line-clamp-1 text-sm text-muted-foreground">
          {opportunity.project?.name ?? opportunity.organization?.name ?? t("noProject")}
        </p>

        {opportunity.moderation_reason && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {t("moderationReason", { reason: opportunity.moderation_reason })}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {t("createdOn", {
            date: dateFormatter.format(new Date(opportunity.created_at)),
          })}
          {opportunity.published_at
            ? ` · ${t("publishedAtLabel", {
                date: dateFormatter.format(new Date(opportunity.published_at)),
              })}`
            : null}
        </p>

        <p className="text-xs text-muted-foreground">
          {compensation.value || t("compensationNotSet")}
          {location.length > 0 ? ` · ${location.join(", ")}` : null}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {isPublished && (
            <Link
              href={`/oportunidades/${opportunity.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Eye aria-hidden="true" />
              {t("view")}
            </Link>
          )}
          {editable && (
            <Link
              href={`/oportunidades/${opportunity.id}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil aria-hidden="true" />
              {t("edit")}
            </Link>
          )}

          {publishable && (
            <form action={changeOpportunityStatusAction}>
              <input type="hidden" name="opportunity_id" value={opportunity.id} />
              <input type="hidden" name="status" value="published" />
              <button type="submit" className={buttonVariants({ size: "sm" })}>
                <Send aria-hidden="true" />
                {t("publish")}
              </button>
            </form>
          )}

          {closable && (
            <form action={changeOpportunityStatusAction}>
              <input type="hidden" name="opportunity_id" value={opportunity.id} />
              <input type="hidden" name="status" value="closed" />
              <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Archive aria-hidden="true" />
                {t("close")}
              </button>
            </form>
          )}

          {fillable && (
            <form action={changeOpportunityStatusAction}>
              <input type="hidden" name="opportunity_id" value={opportunity.id} />
              <input type="hidden" name="status" value="filled" />
              <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <CheckCircle2 aria-hidden="true" />
                {t("fill")}
              </button>
            </form>
          )}

          {cancellable && opportunity.status !== "cancelled" && (
            <form action={changeOpportunityStatusAction}>
              <input type="hidden" name="opportunity_id" value={opportunity.id} />
              <input type="hidden" name="status" value="cancelled" />
              <button type="submit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <XCircle aria-hidden="true" />
                {t("cancel")}
              </button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export async function generateMetadata() {
  return { title: await pageMetadataTitle("panelOpportunities") };
}

export default async function PanelOpportunitiesPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("opportunity");

  const opportunities = await listOpportunitiesForUser(supabase, user.id);

  const sections = new Map<PanelSectionKey, OpportunityWithDetails[]>();
  for (const opportunity of opportunities) {
    const key = getPanelSection(opportunity);
    if (key) {
      sections.set(key, [...(sections.get(key) ?? []), opportunity]);
    }
  }

  const ordered = PANEL_SECTION_ORDER.filter((key) => (sections.get(key)?.length ?? 0) > 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("panelTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("panelDescription")}</p>
        </div>
        <Link href="/publicar/oportunidad" className={buttonVariants()}>
          {t("newTitle")}
        </Link>
      </div>

      {ordered.length === 0 ? (
        <OpportunityEmptyState />
      ) : (
        <div className="grid gap-8">
          {ordered.map((key) => (
            <section key={key} className="grid gap-3">
              <div className="grid gap-1">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(`panelSections.${key}`)}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {sections.get(key)!.length}{" "}
                  {sections.get(key)!.length === 1 ? t("panelItem") : t("panelItems")}
                </p>
              </div>
              <div className="grid gap-3">
                {sections.get(key)!.map((opportunity) => (
                  <OpportunityPanelCard key={opportunity.id} opportunity={opportunity} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
