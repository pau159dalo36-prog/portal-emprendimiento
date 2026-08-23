import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { getOpportunityById } from "@/opportunities/data";
import { toOpportunityFormData } from "@/opportunities/map";
import { listOrganizationsForUser } from "@/organizations/data";
import { listProjectsForUser } from "@/projects/data";

type EditOpportunityPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata() {
  return { title: await pageMetadataTitle("editOpportunity") };
}

export default async function EditOpportunityPage({ params }: EditOpportunityPageProps) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("opportunity");

  const opportunity = await getOpportunityById(supabase, id);
  if (!opportunity || opportunity.creator_id !== user.id) {
    notFound();
  }

  const [projects, organizations] = await Promise.all([
    listProjectsForUser(supabase, user.id),
    listOrganizationsForUser(supabase, user.id),
  ]);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("editDescription")}</p>
      </div>

      <Card>
        <CardContent>
          <OpportunityForm
            mode="edit"
            opportunityId={id}
            initial={toOpportunityFormData(opportunity)}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
