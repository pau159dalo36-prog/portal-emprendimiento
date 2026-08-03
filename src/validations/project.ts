import { z } from "zod";
import type { ValidationTranslator } from "@/validations/auth";
import {
  INDUSTRIES,
  MAX_INDUSTRIES,
} from "@/organizations/constants";
import {
  NEED_STATUSES,
  PROJECT_LINK_TYPES,
  PROJECT_MANAGEABLE_ROLES,
  PROJECT_STAGES,
} from "@/projects/constants";
import {
  createEnumArraySchema,
  createIsCheckedSchema,
  createOptionalTextSchema,
  createOptionalUrlSchema,
  createRequiredTextSchema,
  createSlugSchema,
} from "@/validations/fields";

export function createProjectSlugSchema(t: ValidationTranslator) {
  return createSlugSchema(t, {
    min: 3,
    max: 60,
    minKey: "projectSlugMin",
    maxKey: "projectSlugMax",
    charsKey: "slugChars",
  });
}

export function createProjectSchema(t: ValidationTranslator) {
  return z.object({
    name: createRequiredTextSchema(t, "projectName", 2, 120),
    slug: createProjectSlugSchema(t),
    tagline: createOptionalTextSchema(t, "projectTagline", 140),
    description: createOptionalTextSchema(t, "projectDescription", 5000),
    problem: createOptionalTextSchema(t, "projectProblem", 2000),
    solution: createOptionalTextSchema(t, "projectSolution", 2000),
    target_market: createOptionalTextSchema(t, "projectTargetMarket", 2000),
    traction: createOptionalTextSchema(t, "projectTraction", 2000),
    stage: z.enum(PROJECT_STAGES, { error: t("stageInvalid") }),
    industries: createEnumArraySchema(INDUSTRIES).max(
      MAX_INDUSTRIES,
      t("maxItems", { count: MAX_INDUSTRIES, label: t("labels.industries") }),
    ),
    website_url: createOptionalUrlSchema(t),
    cover_image_url: createOptionalUrlSchema(t),
    is_public: createIsCheckedSchema(),
  });
}

export function createProjectUpdateSchema(t: ValidationTranslator) {
  return createProjectSchema(t).extend({
    organization_id: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().uuid().nullable(),
    ),
    status: z.enum(["draft", "published", "archived"], { error: t("statusInvalid") }),
  });
}

export function createProjectLinkSchema(t: ValidationTranslator) {
  return z.object({
    link_type: z.enum(PROJECT_LINK_TYPES, { error: t("linkTypeInvalid") }),
    label: createRequiredTextSchema(t, "linkLabel", 1, 80),
    url: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      z.string().trim().url(t("urlInvalid")).max(2048, t("urlTooLong")).refine(
        (url) => url.startsWith("http://") || url.startsWith("https://"),
        { error: t("urlProtocol") },
      ),
    ),
  });
}

export function createProjectNeedSchema(t: ValidationTranslator) {
  return z.object({
    title: createRequiredTextSchema(t, "needTitle", 2, 120),
    description: createOptionalTextSchema(t, "needDescription", 1000),
    commitment: createOptionalTextSchema(t, "needCommitment", 120),
  });
}

export function createProjectMemberRoleSchema(t: ValidationTranslator) {
  return z.enum(PROJECT_MANAGEABLE_ROLES, { error: t("roleInvalid") });
}

export function createNeedStatusSchema(t: ValidationTranslator) {
  return z.enum(NEED_STATUSES, { error: t("statusInvalid") });
}

export type ProjectInput = z.infer<ReturnType<typeof createProjectSchema>>;
export type ProjectUpdateInput = z.infer<ReturnType<typeof createProjectUpdateSchema>>;
export type ProjectLinkInput = z.infer<ReturnType<typeof createProjectLinkSchema>>;
export type ProjectNeedInput = z.infer<ReturnType<typeof createProjectNeedSchema>>;
