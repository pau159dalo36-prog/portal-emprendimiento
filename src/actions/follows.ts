"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/session";
import type { FormState } from "@/actions/form-state";
import { isFollowTargetId } from "@/validations/follows";
import {
  followOrganization,
  followProfile,
  followProject,
  unfollowOrganization,
  unfollowProfile,
  unfollowProject,
} from "@/follows/data";

export type FollowFormState = FormState & { following?: boolean };

const FOLLOW_TARGETS = ["profile", "project", "organization"] as const;
export type FollowTarget = (typeof FOLLOW_TARGETS)[number];

function isFollowTarget(value: unknown): value is FollowTarget {
  return typeof value === "string" && (FOLLOW_TARGETS as readonly string[]).includes(value);
}

export async function toggleFollowAction(
  _prevState: FollowFormState,
  formData: FormData,
): Promise<FollowFormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("actions.follow");

  const targetType = formData.get("target_type");
  const targetId = formData.get("target_id");
  const following = formData.get("following") === "1";

  if (!isFollowTarget(targetType) || !isFollowTargetId(targetId)) {
    return { status: "error", message: t("invalidTarget") };
  }

  const result =
    targetType === "profile"
      ? following
        ? await unfollowProfile(supabase, user.id, targetId)
        : await followProfile(supabase, user.id, targetId)
      : targetType === "project"
        ? following
          ? await unfollowProject(supabase, user.id, targetId)
          : await followProject(supabase, user.id, targetId)
        : following
          ? await unfollowOrganization(supabase, user.id, targetId)
          : await followOrganization(supabase, user.id, targetId);

  if (result.error) {
    if (result.error.includes("FOLLOW_BLOCKED")) {
      return { status: "error", message: t("blocked"), following };
    }
    return { status: "error", message: t("failed"), following };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: t("done"), following: !following };
}
