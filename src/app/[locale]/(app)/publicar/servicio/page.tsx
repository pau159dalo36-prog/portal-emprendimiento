import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { ServiceForm } from "@/components/services/service-form";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("publishService") };
}

// Publicar un servicio: cualquier perfil autenticado puede ofrecer su trabajo
// (desarrollo, diseño, marketing, mentoría...). Sin pagos: el precio es solo
// señal informativa.
export default async function NewServicePage() {
  await requireUser();
  const t = await getTranslations("services");

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("newDescription")}</p>
      </div>

      <Card>
        <CardContent>
          <ServiceForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
