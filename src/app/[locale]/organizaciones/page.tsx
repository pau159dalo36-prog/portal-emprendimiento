import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/auth/session";
import { OrgCard } from "@/components/organizations/org-card";
import { buttonVariants } from "@/components/ui/button";
import { listOrganizations } from "@/organizations/data";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("organizations") };
}

export default async function OrganizationsListPage() {
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("organizations");

  const organizations = await listOrganizations(supabase);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {user && (
          <Link href="/organizaciones/nueva" className={buttonVariants()}>
            {t("newTitle")}
          </Link>
        )}
      </div>

      {organizations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {organizations.map((organization) => (
            <OrgCard key={organization.id} organization={organization} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}
