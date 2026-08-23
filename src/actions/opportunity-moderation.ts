"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/auth/session";
import type { FormState } from "@/actions/form-state";
import { MAX_MODERATION_REASON_LENGTH } from "@/config/moderation";

function isPlatformAdmin(appMetadata: Record<string, unknown> | undefined): boolean {
  return appMetadata?.role === "admin";
}

export async function moderateOpportunityAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("actions.opportunityModeration");

  if (!user) {
    return { status: "error", message: t("unauthorized") };
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!isPlatformAdmin(claimsData?.claims?.app_metadata)) {
    return { status: "error", message: t("unauthorized") };
  }

  const opportunityId = formData.get("opportunity_id");
  if (typeof opportunityId !== "string" || !z.string().uuid().safeParse(opportunityId).success) {
    return { status: "error", message: t("invalidRequest") };
  }

  const intent = formData.get("intent");
  if (intent !== "approve" && intent !== "reject" && intent !== "flag") {
    return { status: "error", message: t("invalidRequest") };
  }

  const rawReason = formData.get("reason");
  const reason =
    typeof rawReason === "string" && rawReason.trim() !== "" ? rawReason.trim() : null;
  if (reason !== null && reason.length > MAX_MODERATION_REASON_LENGTH) {
    return { status: "error", message: t("reasonTooLong") };
  }

  const rejectionArgs: { p_opportunity_id: string; p_reason?: string } = {
    p_opportunity_id: opportunityId,
  };
  if (reason !== null) {
    rejectionArgs.p_reason = reason;
  }

  const { error } =
    intent === "approve"
      ? await supabase.rpc("admin_approve_opportunity", { p_opportunity_id: opportunityId })
      : intent === "reject"
        ? await supabase.rpc("admin_reject_opportunity", rejectionArgs)
        : await supabase.rpc("admin_flag_opportunity", rejectionArgs);

  if (error) {
    return { status: "error", message: t("moderationFailed") };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("done") };
}
