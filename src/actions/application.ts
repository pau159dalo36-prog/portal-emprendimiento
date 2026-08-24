"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import { validationState, type FormState } from "@/actions/form-state";
import { createApplicationSchema } from "@/validations/application";

function isUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && z.string().uuid().safeParse(value).success;
}

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

function isDuplicateKeyError(error: { code?: string | null } | null): boolean {
  return error?.code === "23505";
}

/**
 * Crea la candidatura del usuario autenticado para una oportunidad.
 * El actor es SIEMPRE auth.uid(): nunca se acepta applicant_id del cliente.
 * La elegibilidad (publicada/no moderada en contra/turno vivo/visible),
 * el veto de auto-postulación y los bloqueos los valida la RLS.
 * UNIQUE(opportunity_id, applicant_id) hace el doble click idempotente.
 */
export async function applyToOpportunityAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const tv = await getTranslations("applicationValidation");
  const ta = await getTranslations("actions.application");

  const opportunityId = formData.get("opportunity_id");
  if (!isUuid(opportunityId)) {
    return { status: "error", message: ta("invalidOpportunity") };
  }

  const parsed = createApplicationSchema(tv).safeParse({
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const { error } = await supabase.from("applications").insert({
    opportunity_id: opportunityId,
    applicant_id: user.id,
    message: parsed.data.message,
  });

  if (error) {
    if (isDuplicateKeyError(error)) {
      return { status: "error", message: ta("alreadyApplied") };
    }
    return { status: "error", message: ta("applyFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: ta("applied") };
}

/** Retirar la propia candidatura pendiente (submitted|viewed → withdrawn).
 * RLS + trigger impiden retirar las ajenas o una ya decidida. */
export async function withdrawApplicationAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const applicationId = formData.get("application_id");
  if (!isUuid(applicationId)) {
    return;
  }

  const { error } = await supabase
    .from("applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("applicant_id", user.id);

  if (error) {
    return;
  }

  revalidatePath("/", "layout");
}

async function decide(
  supabase: Supabase,
  applicationId: string,
  status: "viewed" | "accepted" | "rejected",
): Promise<boolean> {
  // Sin .eq("opportunity_id"): el perímetro manager lo fija la RLS
  // (applications_select_manager + trigger), nunca el cliente.
  const { data, error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .select("id");

  return !error && (data ?? []).length > 0;
}

/** Manager: marca la candidatura como vista (submitted → viewed). */
export async function markApplicationViewedAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const applicationId = formData.get("application_id");
  if (!isUuid(applicationId)) {
    return;
  }

  if (!(await decide(supabase, applicationId, "viewed"))) {
    return;
  }
  revalidatePath("/", "layout");
}

/** Manager: acepta candidatura pendiente (submitted|viewed → accepted).
 * NO cierra ni marca filled la oportunidad automáticamente: decisión manual. */
export async function acceptApplicationAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const applicationId = formData.get("application_id");
  if (!isUuid(applicationId)) {
    return;
  }

  if (!(await decide(supabase, applicationId, "accepted"))) {
    return;
  }
  revalidatePath("/", "layout");
}

/** Manager: rechaza candidatura pendiente (submitted|viewed → rejected). */
export async function rejectApplicationAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const applicationId = formData.get("application_id");
  if (!isUuid(applicationId)) {
    return;
  }

  if (!(await decide(supabase, applicationId, "rejected"))) {
    return;
  }
  revalidatePath("/", "layout");
}
