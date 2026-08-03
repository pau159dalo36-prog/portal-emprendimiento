"use server";

import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/auth/session";
import { validationState, type FormState } from "@/actions/form-state";
import { getPathname } from "@/i18n/navigation";
import { createMemberUsernameSchema } from "@/validations/organization";
import {
  createNeedStatusSchema,
  createProjectLinkSchema,
  createProjectMemberRoleSchema,
  createProjectNeedSchema,
  createProjectSchema,
  createProjectUpdateSchema,
} from "@/validations/project";

function isUniqueViolation(error: { code?: string | null }): boolean {
  return error?.code === "23505";
}

export async function createProjectAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.project");

  const parsed = createProjectSchema(t).safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    problem: formData.get("problem"),
    solution: formData.get("solution"),
    target_market: formData.get("target_market"),
    traction: formData.get("traction"),
    stage: formData.get("stage"),
    industries: formData.getAll("industries"),
    website_url: formData.get("website_url"),
    cover_image_url: formData.get("cover_image_url"),
    is_public: formData.get("is_public"),
  });

  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const { error } = await supabase.from("projects").insert({
    ...parsed.data,
    owner_id: user.id,
    status: "draft",
  });

  if (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: ta("slugTaken"),
        fieldErrors: { slug: [ta("slugTakenField")] },
      };
    }
    return { status: "error", message: ta("createFailed") };
  }

  redirect(getPathname({ href: `/proyectos/${parsed.data.slug}`, locale }));
}

export async function updateProjectAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.project");

  const projectId = formData.get("project_id");
  if (typeof projectId !== "string" || !z.string().uuid().safeParse(projectId).success) {
    return { status: "error", message: ta("invalidProject") };
  }

  const parsed = createProjectUpdateSchema(t).safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    problem: formData.get("problem"),
    solution: formData.get("solution"),
    target_market: formData.get("target_market"),
    traction: formData.get("traction"),
    stage: formData.get("stage"),
    industries: formData.getAll("industries"),
    website_url: formData.get("website_url"),
    cover_image_url: formData.get("cover_image_url"),
    is_public: formData.get("is_public"),
    organization_id: formData.get("organization_id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const { error } = await supabase.from("projects").update(parsed.data).eq("id", projectId);

  if (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: ta("slugTaken"),
        fieldErrors: { slug: [ta("slugTakenField")] },
      };
    }
    return { status: "error", message: ta("updateFailed") };
  }

  redirect(getPathname({ href: `/proyectos/${parsed.data.slug}`, locale }));
}

export async function addProjectMemberAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.project");

  const projectId = formData.get("project_id");
  if (typeof projectId !== "string" || !z.string().uuid().safeParse(projectId).success) {
    return { status: "error", message: ta("invalidProject") };
  }

  const parsed = createMemberUsernameSchema(t).safeParse(formData.get("username"));
  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", parsed.data)
    .maybeSingle();

  if (!profile) {
    return { status: "error", message: ta("memberNotFound") };
  }

  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    profile_id: profile.id,
    role: "contributor",
  });

  if (error) {
    if (isUniqueViolation(error)) {
      return { status: "error", message: ta("memberAlready") };
    }
    return { status: "error", message: ta("memberAddFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: ta("memberAdded") };
}

export async function updateProjectMemberRoleAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const t = await getTranslations("validation");

  const memberId = formData.get("member_id");
  const parsed = createProjectMemberRoleSchema(t).safeParse(formData.get("role"));

  if (typeof memberId !== "string" || !parsed.success) {
    return;
  }

  await supabase.from("project_members").update({ role: parsed.data }).eq("id", memberId);
  revalidatePath("/", "layout");
}

export async function removeProjectMemberAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const memberId = formData.get("member_id");
  if (typeof memberId !== "string") {
    return;
  }

  await supabase.from("project_members").delete().eq("id", memberId);
  revalidatePath("/", "layout");
}

export async function addProjectNeedAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.project");

  const projectId = formData.get("project_id");
  if (typeof projectId !== "string" || !z.string().uuid().safeParse(projectId).success) {
    return { status: "error", message: ta("invalidProject") };
  }

  const parsed = createProjectNeedSchema(t).safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    commitment: formData.get("commitment"),
  });

  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const { error } = await supabase.from("project_needs").insert({
    ...parsed.data,
    project_id: projectId,
  });

  if (error) {
    return { status: "error", message: ta("needAddFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: ta("needAdded") };
}

export async function updateProjectNeedStatusAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const t = await getTranslations("validation");

  const needId = formData.get("need_id");
  const parsed = createNeedStatusSchema(t).safeParse(formData.get("status"));

  if (typeof needId !== "string" || !parsed.success) {
    return;
  }

  await supabase.from("project_needs").update({ status: parsed.data }).eq("id", needId);
  revalidatePath("/", "layout");
}

export async function removeProjectNeedAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const needId = formData.get("need_id");
  if (typeof needId !== "string") {
    return;
  }

  await supabase.from("project_needs").delete().eq("id", needId);
  revalidatePath("/", "layout");
}

export async function addProjectLinkAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.project");

  const projectId = formData.get("project_id");
  if (typeof projectId !== "string" || !z.string().uuid().safeParse(projectId).success) {
    return { status: "error", message: ta("invalidProject") };
  }

  const parsed = createProjectLinkSchema(t).safeParse({
    link_type: formData.get("link_type"),
    label: formData.get("label"),
    url: formData.get("url"),
  });

  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const { error } = await supabase.from("project_links").insert({
    ...parsed.data,
    project_id: projectId,
  });

  if (error) {
    return { status: "error", message: ta("linkAddFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: ta("linkAdded") };
}

export async function removeProjectLinkAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const linkId = formData.get("link_id");
  if (typeof linkId !== "string") {
    return;
  }

  await supabase.from("project_links").delete().eq("id", linkId);
  revalidatePath("/", "layout");
}
