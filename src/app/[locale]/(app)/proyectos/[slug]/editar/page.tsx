import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  addProjectLinkAction,
  addProjectMemberAction,
  addProjectNeedAction,
  removeProjectLinkAction,
  removeProjectMemberAction,
  removeProjectNeedAction,
  updateProjectMemberRoleAction,
  updateProjectNeedStatusAction,
} from "@/actions/project";
import { requireUser } from "@/auth/session";
import { LinkManager } from "@/components/shared/link-manager";
import { MemberManager } from "@/components/shared/member-manager";
import { NeedManager } from "@/components/projects/need-manager";
import { ProjectForm } from "@/components/projects/project-form";
import {
  PROJECT_LINK_TYPES,
  PROJECT_MANAGEABLE_ROLES,
} from "@/projects/constants";
import {
  getProjectBySlug,
  getProjectLinks,
  getProjectMembers,
  getProjectNeeds,
  isProjectMember,
} from "@/projects/data";
import { listOrganizationsForUser } from "@/organizations/data";
import { toProjectFormData } from "@/projects/map";
import { pageMetadataTitle } from "@/i18n/metadata";
import { getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";

type EditProjectPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata() {
  return { title: await pageMetadataTitle("editProject") };
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { slug, locale } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("projects");

  const project = await getProjectBySlug(supabase, slug);
  if (!project) {
    notFound();
  }

  const isMember = await isProjectMember(supabase, project.id, user.id);
  if (!isMember) {
    redirect(getPathname({ href: `/proyectos/${project.slug}`, locale }));
  }

  const isOwner = project.owner_id === user.id;

  const [members, needs, links, organizations] = await Promise.all([
    getProjectMembers(supabase, project.id),
    getProjectNeeds(supabase, project.id),
    getProjectLinks(supabase, project.id),
    isOwner ? listOrganizationsForUser(supabase, user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("editDescription")}</p>
      </div>

      {isOwner && (
        <section className="grid gap-6 rounded-2xl border border-border/60 bg-card p-6">
          <ProjectForm
            mode="edit"
            projectId={project.id}
            initial={toProjectFormData(project)}
            organizations={organizations}
          />
        </section>
      )}

      {isOwner && (
        <section className="grid gap-6 rounded-2xl border border-border/60 bg-card p-6">
          <MemberManager
            members={members}
            roles={PROJECT_MANAGEABLE_ROLES}
            roleLabelsNamespace="projectRoles"
            addAction={addProjectMemberAction}
            updateRoleAction={updateProjectMemberRoleAction}
            removeAction={removeProjectMemberAction}
            entityFieldName="project_id"
            entityId={project.id}
            canManage={isOwner}
          />
        </section>
      )}

      <section className="grid gap-6 rounded-2xl border border-border/60 bg-card p-6">
        <NeedManager
          needs={needs}
          addAction={addProjectNeedAction}
          updateStatusAction={updateProjectNeedStatusAction}
          removeAction={removeProjectNeedAction}
          projectId={project.id}
          canManage={isMember}
        />
      </section>

      <section className="grid gap-6 rounded-2xl border border-border/60 bg-card p-6">
        <LinkManager
          links={links}
          linkTypes={PROJECT_LINK_TYPES}
          addAction={addProjectLinkAction}
          removeAction={removeProjectLinkAction}
          entityFieldName="project_id"
          entityId={project.id}
          canManage={isMember}
        />
      </section>
    </div>
  );
}
