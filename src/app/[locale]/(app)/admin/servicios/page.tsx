import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/auth/admin";
import { ServiceModerationForm } from "@/components/service/service-moderation-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { listServicesForModeration } from "@/services/data";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("adminServices") };
}

export default async function AdminServicesPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("serviceModeration");
  const statuses = await getTranslations("moderationStatuses");

  const services = await listServicesForModeration(supabase);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-3">
          {services.map((service) => (
            <Card key={service.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="border-border bg-muted text-muted-foreground">
                    {statuses(service.moderation_status as Parameters<typeof statuses>[0])}
                  </Badge>
                </div>
                <ServiceModerationForm
                  service={{
                    id: service.id,
                    title: service.title,
                    description: service.description,
                    providerName: service.provider?.full_name ?? null,
                    providerUsername: service.provider?.username ?? null,
                    visibility: service.visibility,
                    moderationStatus: service.moderation_status,
                    moderationReason: service.moderation_reason,
                    createdAt: service.created_at,
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