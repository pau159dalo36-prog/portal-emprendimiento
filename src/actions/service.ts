"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import { validationState, type FormState } from "@/actions/form-state";
import {
  SERVICE_STATUS_TRANSITIONS,
  type ServiceStatus,
} from "@/services/constants";
import { createServiceSchema } from "@/services/schemas";

function isUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && z.string().uuid().safeParse(value).success;
}

async function getOwnServiceId(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  serviceId: string,
) {
  const { data } = await supabase
    .from("services")
    .select("id, status")
    .eq("id", serviceId)
    .eq("provider_id", userId)
    .maybeSingle();
  return data;
}

export type ServiceSaveIntent = "save" | "publish";

// Crea (sin service_id) o actualiza un servicio propio. El formulario envía
// "intent" para publicar o guardar borrador; el resto de campos define el
// payload. RLS y los triggers de la BD validan autoría, pricing y ciclo de
// vida (draft → published ⇄ paused → archived).
export async function saveServiceAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const tv = await getTranslations("serviceValidation");
  const ta = await getTranslations("actions.service");

  const intent = formData.get("intent");
  if (intent !== "save" && intent !== "publish") {
    return { status: "error", message: ta("invalidIntent") };
  }

  const serviceId = formData.get("service_id");
  const isEditing = typeof serviceId === "string" && serviceId.trim() !== "";
  if (isEditing && !isUuid(serviceId)) {
    return { status: "error", message: ta("invalidService") };
  }

  const parsed = createServiceSchema(tv).safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    delivery_mode: formData.get("delivery_mode"),
    pricing_type: formData.get("pricing_type"),
    // El formulario siempre envía status (hidden); sin él se asume draft.
    status: formData.get("status") ?? "draft",
    visibility: formData.get("visibility"),
    price_amount: formData.get("price_amount"),
    price_min: formData.get("price_min"),
    price_max: formData.get("price_max"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const data = parsed.data;
  const isPublishing = intent === "publish";
  const status: "draft" | "published" = isPublishing ? "published" : data.status;

  const payload = {
    title: data.title,
    description: data.description,
    category: data.category,
    delivery_mode: data.delivery_mode,
    pricing_type: data.pricing_type,
    visibility: data.visibility,
    price_amount: data.price_amount,
    price_min: data.price_min,
    price_max: data.price_max,
    currency: data.currency,
    status,
  };

  if (isEditing) {
    const own = await getOwnServiceId(supabase, user.id, serviceId);
    if (!own) {
      return { status: "error", message: ta("notFound") };
    }
    // Un servicio archivado es terminal: no se edita desde la app.
    if (own.status === "archived") {
      return { status: "error", message: ta("archivedLocked") };
    }
    const { error } = await supabase
      .from("services")
      .update(payload)
      .eq("id", serviceId);
    if (error) {
      return { status: "error", message: ta(isPublishing ? "publishFailed" : "updateFailed") };
    }
    revalidatePath("/", "layout");
    return { status: "success", message: ta(isPublishing ? "published" : "saved") };
  }

  const { error } = await supabase.from("services").insert({
    provider_id: user.id,
    ...payload,
  });
  if (error) {
    return { status: "error", message: ta(isPublishing ? "publishFailed" : "createFailed") };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: ta(isPublishing ? "published" : "draftSaved") };
}

// Transiciones de ciclo de vida desde el panel: publicar borrador, pausar/
// reanudar un publicado o archivar. RLS + trigger validan autoría y transición.
// Fire-and-forget (sin estado), patrón changeOpportunityStatusAction.
export async function changeServiceStatusAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const serviceId = formData.get("service_id");
  const status = formData.get("status");
  if (
    typeof serviceId !== "string" ||
    !isUuid(serviceId) ||
    typeof status !== "string"
  ) {
    return;
  }
  const parsedStatus = z
    .enum(["draft", "published", "paused", "archived"])
    .safeParse(status);
  if (!parsedStatus.success) {
    return;
  }

  const own = await getOwnServiceId(supabase, user.id, serviceId);
  if (!own) {
    return;
  }

  const allowed = SERVICE_STATUS_TRANSITIONS[own.status as ServiceStatus] ?? [];
  if (!allowed.includes(parsedStatus.data)) {
    return;
  }

  const { error } = await supabase
    .from("services")
    .update({ status: parsedStatus.data })
    .eq("id", serviceId);
  if (error) {
    return;
  }

  revalidatePath("/", "layout");
}
