"use server";

import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/auth/session";
import { validationState, type FormState } from "@/actions/form-state";
import { getPathname } from "@/i18n/navigation";
import {
  createMemberUsernameSchema,
  createOrganizationLinkSchema,
  createOrganizationMemberRoleSchema,
  createOrganizationSchema,
} from "@/validations/organization";

function isUniqueViolation(error: { code?: string | null }): boolean {
  return error?.code === "23505";
}

export async function createOrganizationAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.organization");

  const parsed = createOrganizationSchema(t).safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    headline: formData.get("headline"),
    description: formData.get("description"),
    location: formData.get("location"),
    industries: formData.getAll("industries"),
    website_url: formData.get("website_url"),
    contact_email: formData.get("contact_email"),
    is_public: formData.get("is_public"),
  });

  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const { error } = await supabase.from("organizations").insert({
    ...parsed.data,
    owner_id: user.id,
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

  redirect(getPathname({ href: `/organizaciones/${parsed.data.slug}`, locale }));
}

export async function updateOrganizationAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.organization");

  const organizationId = formData.get("organization_id");
  if (typeof organizationId !== "string" || !z.string().uuid().safeParse(organizationId).success) {
    return { status: "error", message: ta("invalidOrganization") };
  }

  const parsed = createOrganizationSchema(t).safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    headline: formData.get("headline"),
    description: formData.get("description"),
    location: formData.get("location"),
    industries: formData.getAll("industries"),
    website_url: formData.get("website_url"),
    contact_email: formData.get("contact_email"),
    is_public: formData.get("is_public"),
  });

  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const { error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", organizationId);

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

  redirect(getPathname({ href: `/organizaciones/${parsed.data.slug}`, locale }));
}

export async function addOrganizationMemberAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.organization");

  const organizationId = formData.get("organization_id");
  if (typeof organizationId !== "string" || !z.string().uuid().safeParse(organizationId).success) {
    return { status: "error", message: ta("invalidOrganization") };
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

  const { error } = await supabase.from("organization_members").insert({
    organization_id: organizationId,
    profile_id: profile.id,
    role: "member",
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

export async function updateOrganizationMemberRoleAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const t = await getTranslations("validation");

  const memberId = formData.get("member_id");
  const parsed = createOrganizationMemberRoleSchema(t).safeParse(formData.get("role"));

  if (typeof memberId !== "string" || !parsed.success) {
    return;
  }

  await supabase.from("organization_members").update({ role: parsed.data }).eq("id", memberId);
  revalidatePath("/", "layout");
}

export async function removeOrganizationMemberAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const memberId = formData.get("member_id");
  if (typeof memberId !== "string") {
    return;
  }

  await supabase.from("organization_members").delete().eq("id", memberId);
  revalidatePath("/", "layout");
}

export async function addOrganizationLinkAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.organization");

  const organizationId = formData.get("organization_id");
  if (typeof organizationId !== "string" || !z.string().uuid().safeParse(organizationId).success) {
    return { status: "error", message: ta("invalidOrganization") };
  }

  const parsed = createOrganizationLinkSchema(t).safeParse({
    link_type: formData.get("link_type"),
    label: formData.get("label"),
    url: formData.get("url"),
  });

  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const { error } = await supabase.from("organization_links").insert({
    ...parsed.data,
    organization_id: organizationId,
  });

  if (error) {
    return { status: "error", message: ta("linkAddFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: ta("linkAdded") };
}

export async function removeOrganizationLinkAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const linkId = formData.get("link_id");
  if (typeof linkId !== "string") {
    return;
  }

  await supabase.from("organization_links").delete().eq("id", linkId);
  revalidatePath("/", "layout");
}
