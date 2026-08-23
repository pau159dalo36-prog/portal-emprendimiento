"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import { validationState, type FormState } from "@/actions/form-state";
import { createOpportunitySchema } from "@/validations/opportunity";

function isUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && z.string().uuid().safeParse(value).success;
}

async function getOwnOpportunityId(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  opportunityId: string,
) {
  const { data } = await supabase
    .from("opportunities")
    .select("id, status, ends_at")
    .eq("id", opportunityId)
    .eq("creator_id", userId)
    .maybeSingle();
  return data;
}

export type OpportunitySaveIntent = "save" | "publish";

// Crea (sin opportunity_id) o actualiza una oportunidad propia. El formulario
// envía "intent" para publicar o guardar borrador; el resto de campos define
// el payload. RLS y los triggers de la BD validan autoría y ciclo de vida.
export async function saveOpportunityAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const tv = await getTranslations("opportunityValidation");
  const ta = await getTranslations("actions.opportunity");

  const intent = formData.get("intent");
  if (intent !== "save" && intent !== "publish") {
    return { status: "error", message: ta("invalidIntent") };
  }

  const opportunityId = formData.get("opportunity_id");
  const isEditing = typeof opportunityId === "string" && opportunityId.trim() !== "";
  if (isEditing && !isUuid(opportunityId)) {
    return { status: "error", message: ta("invalidOpportunity") };
  }

  const parsed = createOpportunitySchema(tv).safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    opportunity_type: formData.get("opportunity_type"),
    employment_type: formData.get("employment_type"),
    experience_level: formData.get("experience_level"),
    work_mode: formData.get("work_mode"),
    industry: formData.get("industry"),
    country: formData.get("country"),
    region: formData.get("region"),
    city: formData.get("city"),
    location_text: formData.get("location_text"),
    status: formData.get("status"),
    visibility: formData.get("visibility"),
    is_first_job_friendly: formData.get("is_first_job_friendly"),
    is_student_friendly: formData.get("is_student_friendly"),
    compensation_type: formData.get("compensation_type"),
    compensation_min: formData.get("compensation_min"),
    compensation_max: formData.get("compensation_max"),
    currency: formData.get("currency"),
    compensation_period: formData.get("compensation_period"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    slots_total: formData.get("slots_total"),
    closes_at: formData.get("closes_at"),
    project_id: formData.get("project_id"),
    organization_id: formData.get("organization_id"),
  });
  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const data = parsed.data;
  const isPublishing = intent === "publish";
  const status = isPublishing ? "published" : data.status;

  if (isEditing) {
    const own = await getOwnOpportunityId(supabase, user.id, opportunityId);
    if (!own) {
      return { status: "error", message: ta("notFound") };
    }
    const { error } = await supabase
      .from("opportunities")
      .update({
        title: data.title,
        description: data.description,
        opportunity_type: data.opportunity_type,
        employment_type: data.employment_type,
        experience_level: data.experience_level,
        work_mode: data.work_mode,
        industry: data.industry,
        country: data.country,
        region: data.region,
        city: data.city,
        location_text: data.location_text,
        visibility: data.visibility,
        is_first_job_friendly: data.is_first_job_friendly,
        is_student_friendly: data.is_student_friendly,
        compensation_type: data.compensation_type,
        compensation_min: data.compensation_min,
        compensation_max: data.compensation_max,
        currency: data.currency,
        compensation_period: data.compensation_period,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        slots_total: data.slots_total,
        closes_at: data.closes_at,
        project_id: data.project_id,
        organization_id: data.organization_id,
        status,
      })
      .eq("id", opportunityId);
    if (error) {
      return { status: "error", message: ta(isPublishing ? "publishFailed" : "updateFailed") };
    }
    revalidatePath("/", "layout");
    return { status: "success", message: ta(isPublishing ? "published" : "saved") };
  }

  const { error } = await supabase.from("opportunities").insert({
    creator_id: user.id,
    title: data.title,
    description: data.description,
    opportunity_type: data.opportunity_type,
    employment_type: data.employment_type,
    experience_level: data.experience_level,
    work_mode: data.work_mode,
    industry: data.industry,
    country: data.country,
    region: data.region,
    city: data.city,
    location_text: data.location_text,
    visibility: data.visibility,
    is_first_job_friendly: data.is_first_job_friendly,
    is_student_friendly: data.is_student_friendly,
    compensation_type: data.compensation_type,
    compensation_min: data.compensation_min,
    compensation_max: data.compensation_max,
    currency: data.currency,
    compensation_period: data.compensation_period,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    slots_total: data.slots_total,
    closes_at: data.closes_at,
    project_id: data.project_id,
    organization_id: data.organization_id,
    status,
  });
  if (error) {
    return { status: "error", message: ta(isPublishing ? "publishFailed" : "createFailed") };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: ta(isPublishing ? "published" : "draftSaved") };
}

// Transiciones de ciclo de vida desde el panel: publicar un borrador o cerrar
// un publicado. RLS + triggers validan autoría y sincronizan el post.
export async function changeOpportunityStatusAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const opportunityId = formData.get("opportunity_id");
  const status = formData.get("status");
  if (
    typeof opportunityId !== "string" ||
    !isUuid(opportunityId) ||
    (status !== "published" && status !== "closed" && status !== "filled" && status !== "cancelled")
  ) {
    return;
  }

  const own = await getOwnOpportunityId(supabase, user.id, opportunityId);
  if (!own) {
    return;
  }

  const validTransition =
    (status === "published" && own.status === "draft") ||
    (status === "closed" && own.status === "published") ||
    (status === "filled" && own.status === "published") ||
    (status === "cancelled" && (own.status === "draft" || own.status === "published"));

  if (!validTransition) {
    return;
  }

  const { error } = await supabase.from("opportunities").update({ status }).eq("id", opportunityId);
  if (error) {
    return;
  }

  revalidatePath("/", "layout");
}
