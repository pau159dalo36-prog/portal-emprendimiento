import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { ServiceForm } from "@/components/services/service-form";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import type { ServiceStatus } from "@/services/constants";
import { getServiceById } from "@/services/data";
import { toServiceFormData } from "@/services/map";

type EditServicePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata() {
  return { title: await pageMetadataTitle("editService") };
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("services");

  const service = await getServiceById(supabase, id);
  if (!service || service.provider_id !== user.id) {
    notFound();
  }

  // Un servicio archivado es terminal: no se edita desde la app.
  const archived = (service.status as ServiceStatus) === "archived";

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("editDescription")}</p>
      </div>

      <Card>
        <CardContent>
          {archived ? (
            <p className="text-sm text-muted-foreground">{t("archivedNotice")}</p>
          ) : (
            <ServiceForm
              mode="edit"
              serviceId={id}
              initial={toServiceFormData(service)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
