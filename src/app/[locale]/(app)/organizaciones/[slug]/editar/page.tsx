import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  addOrganizationLinkAction,
  addOrganizationMemberAction,
  removeOrganizationLinkAction,
  removeOrganizationMemberAction,
  updateOrganizationMemberRoleAction,
} from "@/actions/organization";
import { requireUser } from "@/auth/session";
import { LinkManager } from "@/components/shared/link-manager";
import { MemberManager } from "@/components/shared/member-manager";
import { OrganizationForm } from "@/components/organizations/organization-form";
import { ORGANIZATION_LINK_TYPES, ORGANIZATION_MEMBER_ROLES } from "@/organizations/constants";
import {
  getOrganizationBySlug,
  getOrganizationLinks,
  getOrganizationMembers,
  isOrganizationManager,
} from "@/organizations/data";
import { toOrganizationFormData } from "@/organizations/map";
import { pageMetadataTitle } from "@/i18n/metadata";
import { getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";

type EditOrganizationPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata() {
  return { title: await pageMetadataTitle("editOrganization") };
}

export default async function EditOrganizationPage({
  params,
}: EditOrganizationPageProps) {
  const { slug, locale } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("organizations");

  const organization = await getOrganizationBySlug(supabase, slug);
  if (!organization) {
    notFound();
  }

  const canManage = await isOrganizationManager(supabase, organization.id, user.id);
  if (!canManage) {
    redirect(getPathname({ href: `/organizaciones/${organization.slug}`, locale }));
  }

  const [members, links] = await Promise.all([
    getOrganizationMembers(supabase, organization.id),
    getOrganizationLinks(supabase, organization.id),
  ]);

  const canEditCore = organization.owner_id === user.id;

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("editDescription")}</p>
      </div>

      {canEditCore && (
        <section className="grid gap-6 rounded-2xl border border-border/60 bg-card p-6">
          <OrganizationForm
            mode="edit"
            organizationId={organization.id}
            initial={toOrganizationFormData(organization)}
          />
        </section>
      )}

      <section className="grid gap-6 rounded-2xl border border-border/60 bg-card p-6">
        <MemberManager
          members={members}
          roles={ORGANIZATION_MEMBER_ROLES.filter((role) => role !== "owner")}
          roleLabelsNamespace="orgRoles"
          addAction={addOrganizationMemberAction}
          updateRoleAction={updateOrganizationMemberRoleAction}
          removeAction={removeOrganizationMemberAction}
          entityFieldName="organization_id"
          entityId={organization.id}
          canManage={canManage}
        />
      </section>

      <section className="grid gap-6 rounded-2xl border border-border/60 bg-card p-6">
        <LinkManager
          links={links}
          linkTypes={ORGANIZATION_LINK_TYPES}
          addAction={addOrganizationLinkAction}
          removeAction={removeOrganizationLinkAction}
          entityFieldName="organization_id"
          entityId={organization.id}
          canManage={canManage}
        />
      </section>
    </div>
  );
}
