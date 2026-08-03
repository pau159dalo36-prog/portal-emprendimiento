import { getTranslations } from "next-intl/server";

import { OrganizationForm } from "@/components/organizations/organization-form";
import { pageMetadataTitle } from "@/i18n/metadata";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("newOrganization") };
}

export default async function NewOrganizationPage() {
  const t = await getTranslations("organizations");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("newDescription")}</p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <OrganizationForm mode="create" />
      </div>
    </div>
  );
}
