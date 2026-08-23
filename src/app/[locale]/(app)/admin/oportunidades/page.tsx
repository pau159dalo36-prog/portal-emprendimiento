import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/auth/admin";
import { OpportunityModerationForm } from "@/components/opportunities/opportunity-moderation-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { listOpportunitiesForModeration } from "@/opportunities/data";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("adminOpportunities") };
}

export default async function AdminOpportunitiesPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("moderation");
  const statuses = await getTranslations("moderationStatuses");

  const opportunities = await listOpportunitiesForModeration(supabase);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-3">
          {opportunities.map((opportunity) => (
            <Card key={opportunity.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="border-border bg-muted text-muted-foreground">
                    {statuses(
                      opportunity.moderation_status as Parameters<typeof statuses>[0],
                    )}
                  </Badge>
                </div>
                <OpportunityModerationForm
                  opportunity={{
                    id: opportunity.id,
                    title: opportunity.title,
                    type: opportunity.opportunity_type,
                    ownerName: opportunity.owner?.full_name ?? null,
                    ownerUsername: opportunity.owner?.username ?? null,
                    status: opportunity.status,
                    moderationStatus: opportunity.moderation_status,
                    moderationReason: opportunity.moderation_reason,
                    createdAt: opportunity.created_at,
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
