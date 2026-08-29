"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import { getCurrentUser } from "@/auth/session";
import type { FormState } from "@/actions/form-state";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  MAX_REPORT_NOTE_LENGTH,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
} from "@/reports/config";

export async function submitReportAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("actions.report");

  // Mitigación de abuso: pocos reportes por usuario (evita saturar con spam).
  const withinLimit = await consumeRateLimit(supabase, "report", user.id, 5, 3600);
  if (!withinLimit) {
    return { status: "error", message: t("invalid") };
  }

  const parsed = z
    .object({
      target_type: z.enum(REPORT_TARGET_TYPES),
      target_id: z.string().uuid(),
      reason: z.enum(REPORT_REASONS),
      note: z
        .string()
        .trim()
        .max(MAX_REPORT_NOTE_LENGTH, t("noteTooLong"))
        .optional()
        .transform((value) => (value ? value.slice(0, MAX_REPORT_NOTE_LENGTH) : null)),
    })
    .safeParse({
      target_type: formData.get("target_type"),
      target_id: formData.get("target_id"),
      reason: formData.get("reason"),
      note: formData.get("note") ?? undefined,
    });

  if (!parsed.success) {
    return { status: "error", message: t("invalid") };
  }

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.target_type,
    target_id: parsed.data.target_id,
    reason: parsed.data.reason,
    note: parsed.data.note,
  });

  if (error) {
    return { status: "error", message: t("failed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("done") };
}

function isPlatformAdmin(appMetadata: Record<string, unknown> | undefined): boolean {
  return appMetadata?.role === "admin";
}

export async function resolveReportAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("actions.report");

  if (!user) {
    return { status: "error", message: t("unauthorized") };
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!isPlatformAdmin(claimsData?.claims?.app_metadata)) {
    return { status: "error", message: t("unauthorized") };
  }

  const parsed = z
    .object({
      report_id: z.string().uuid(),
      status: z.enum(["resolved", "dismissed"]),
      note: z
        .string()
        .trim()
        .max(MAX_REPORT_NOTE_LENGTH, t("noteTooLong"))
        .optional()
        .transform((value) => (value ? value.slice(0, MAX_REPORT_NOTE_LENGTH) : null)),
    })
    .safeParse({
      report_id: formData.get("report_id"),
      status: formData.get("status"),
      note: formData.get("resolution_note") ?? undefined,
    });

  if (!parsed.success) {
    return { status: "error", message: t("invalid") };
  }

  const { error } = await supabase.rpc("admin_resolve_report", {
    p_report_id: parsed.data.report_id,
    p_status: parsed.data.status,
    p_resolution_note: parsed.data.note ?? undefined,
  });

  if (error) {
    return { status: "error", message: t("resolveFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("resolveDone") };
}