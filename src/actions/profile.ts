"use server";

import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/auth/session";
import { validationState, type FormState } from "@/actions/form-state";
import type { Database } from "@/types/database.types";
import type { ValidationTranslator } from "@/validations/auth";
import {
  createOnboardingStepSchemas,
  createUpdateProfileSchema,
  type OnboardingStepKey,
  type OnboardingStepSchemas,
} from "@/validations/profile";
import { getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";

const TOTAL_STEPS = 5;

type StepInput = {
  [K in OnboardingStepKey]: z.infer<OnboardingStepSchemas[K]>;
};

type ParsedStep =
  | { ok: true; data: StepInput[OnboardingStepKey] }
  | { ok: false; state: FormState };

function parseStep(
  step: number,
  formData: FormData,
  schemas: OnboardingStepSchemas,
  ta: ValidationTranslator,
): ParsedStep {
  let result:
    | z.ZodSafeParseResult<StepInput[OnboardingStepKey]>
    | undefined;

  if (step === 1) {
    result = schemas[1].safeParse({
      full_name: formData.get("full_name"),
      username: formData.get("username"),
      headline: formData.get("headline"),
      location: formData.get("location"),
    });
  } else if (step === 2) {
    result = schemas[2].safeParse({ bio: formData.get("bio") });
  } else if (step === 3) {
    result = schemas[3].safeParse({
      user_types: formData.getAll("user_types"),
      weekly_availability: formData.get("weekly_availability"),
      collaboration_preferences: formData.getAll("collaboration_preferences"),
    });
  } else if (step === 4) {
    result = schemas[4].safeParse({
      habilidades: formData.getAll("habilidades"),
      intereses: formData.getAll("intereses"),
      niveles: formData.getAll("niveles"),
    });
  } else if (step === 5) {
    result = schemas[5].safeParse({
      website_url: formData.get("website_url"),
      linkedin_url: formData.get("linkedin_url"),
      is_public: formData.get("is_public"),
    });
  } else {
    return { ok: false, state: { status: "error", message: ta("invalidStep") } };
  }

  if (!result.success) {
    return { ok: false, state: validationState(result.error, ta("validationGeneral")) };
  }

  return { ok: true, data: result.data };
}

function parseSkillLevels(niveles: string[]): Map<string, number> {
  const levels = new Map<string, number>();
  for (const raw of niveles) {
    const [skillId, levelRaw] = raw.split(":");
    const level = Number(levelRaw);
    if (skillId && Number.isInteger(level) && level >= 1 && level <= 5) {
      levels.set(skillId, level);
    }
  }
  return levels;
}

async function replaceSkills(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  habilidadIds: string[],
  niveles: string[],
): Promise<boolean> {
  const levels = parseSkillLevels(niveles);
  const { error: deleteError } = await supabase
    .from("profile_skills")
    .delete()
    .eq("profile_id", userId);
  if (deleteError) return false;

  if (habilidadIds.length > 0) {
    const { error: insertError } = await supabase.from("profile_skills").insert(
      habilidadIds.map((skillId) => ({
        profile_id: userId,
        skill_id: skillId,
        level: levels.get(skillId) ?? null,
      })),
    );
    if (insertError) return false;
  }

  return true;
}

async function replaceInterests(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  intereses: string[],
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("profile_interests")
    .delete()
    .eq("profile_id", userId);
  if (deleteError) return false;

  if (intereses.length > 0) {
    const { error: insertError } = await supabase.from("profile_interests").insert(
      intereses.map((name) => ({ profile_id: userId, name })),
    );
    if (insertError) return false;
  }

  return true;
}

function isUsernameTaken(error: { code?: string | null }): boolean {
  return error?.code === "23505";
}

export async function saveOnboardingStepAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.profile");

  const schemas = createOnboardingStepSchemas(t);

  const step = Number(formData.get("step"));
  if (!Number.isInteger(step) || step < 1 || step > TOTAL_STEPS) {
    return { status: "error", message: ta("invalidStep") };
  }

  const parsed = parseStep(step, formData, schemas, ta);
  if (!parsed.ok) {
    return parsed.state;
  }

  if (step === 4) {
    const data = parsed.data as StepInput[4];
    const skillsOk = await replaceSkills(supabase, user.id, data.habilidades, data.niveles);
    if (!skillsOk) {
      return {
        status: "error",
        message: ta("skillsSaveFailed"),
      };
    }

    const interestsOk = await replaceInterests(supabase, user.id, data.intereses);
    if (!interestsOk) {
      return {
        status: "error",
        message: ta("interestsSaveFailed"),
      };
    }

    return {
      status: "success",
      message: ta("stepSaved", { step: 4 }),
      savedStep: 4,
    };
  }

  const payload: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (step === 1) {
    const data = parsed.data as StepInput[1];
    Object.assign(payload, {
      full_name: data.full_name,
      username: data.username,
      headline: data.headline,
      location: data.location,
    });
  } else if (step === 2) {
    const data = parsed.data as StepInput[2];
    Object.assign(payload, { bio: data.bio });
  } else if (step === 3) {
    const data = parsed.data as StepInput[3];
    Object.assign(payload, {
      user_types: data.user_types,
      weekly_availability: data.weekly_availability,
      collaboration_preferences: data.collaboration_preferences,
    });
  } else if (step === 5) {
    const data = parsed.data as StepInput[5];
    Object.assign(payload, {
      website_url: data.website_url,
      linkedin_url: data.linkedin_url,
      is_public: data.is_public,
      onboarding_completed: true,
    });
  }

  const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);

  if (error) {
    if (isUsernameTaken(error)) {
      return {
        status: "error",
        message: ta("usernameTaken"),
        fieldErrors: { username: [ta("usernameTakenField")] },
      };
    }
    return { status: "error", message: ta("stepSaveFailed") };
  }

  if (step === 5) {
    redirect(getPathname({ href: "/panel", locale }));
  }

  return {
    status: "success",
    message: ta("stepSaved", { step }),
    savedStep: step,
  };
}

export async function updateProfileAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("validation");
  const ta = await getTranslations("actions.profile");

  const parsed = createUpdateProfileSchema(t).safeParse({
    full_name: formData.get("full_name"),
    username: formData.get("username"),
    headline: formData.get("headline"),
    bio: formData.get("bio"),
    location: formData.get("location"),
    user_types: formData.getAll("user_types"),
    weekly_availability: formData.get("weekly_availability"),
    collaboration_preferences: formData.getAll("collaboration_preferences"),
    habilidades: formData.getAll("habilidades"),
    intereses: formData.getAll("intereses"),
    niveles: formData.getAll("niveles"),
    website_url: formData.get("website_url"),
    linkedin_url: formData.get("linkedin_url"),
    is_public: formData.get("is_public"),
  });

  if (!parsed.success) {
    return validationState(parsed.error, ta("validationGeneral"));
  }

  const {
    habilidades,
    intereses,
    niveles,
    user_types,
    collaboration_preferences,
    ...profileData
  } = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      ...profileData,
      user_types,
      collaboration_preferences,
    })
    .eq("id", user.id);

  if (error) {
    if (isUsernameTaken(error)) {
      return {
        status: "error",
        message: ta("usernameTaken"),
        fieldErrors: { username: [ta("usernameTakenField")] },
      };
    }
    return { status: "error", message: ta("saveFailed") };
  }

  const skillsOk = await replaceSkills(supabase, user.id, habilidades, niveles);
  if (!skillsOk) {
    return {
      status: "error",
      message: ta("skillsPartial"),
    };
  }

  const interestsOk = await replaceInterests(supabase, user.id, intereses);
  if (!interestsOk) {
    return {
      status: "error",
      message: ta("interestsPartial"),
    };
  }

  return { status: "success", message: ta("saved") };
}
