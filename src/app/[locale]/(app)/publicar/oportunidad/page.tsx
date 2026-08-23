import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { listOrganizationsForUser } from "@/organizations/data";
import { listProjectsForUser } from "@/projects/data";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("opportunityNew") };
}

export default async function NewOpportunityPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("opportunity");

  const [projects, organizations] = await Promise.all([
    listProjectsForUser(supabase, user.id),
    listOrganizationsForUser(supabase, user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t("newTitle")}</CardTitle>
          <CardDescription>{t("newDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <OpportunityForm
            mode="create"
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
