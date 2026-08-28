import { z } from "zod";
import type { ValidationTranslator } from "@/validations/auth";
import {
  INDUSTRIES,
  MAX_INDUSTRIES,
} from "@/organizations/constants";
import {
  FUNDING_AMOUNT_MAX,
  FUNDING_STAGES,
  NEED_KINDS,
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

// Texto opcional tolerante: FormData siempre entrega string|null, pero un
// campo ausente llega como undefined y debe tratarse como NULL.
function optionalText(t: ValidationTranslator, labelKey: string, max: number) {
  const label = t(`labels.${labelKey}`);
  return z.preprocess(
    (value) => (typeof value !== "string" || value.trim() === "" ? null : value),
    z.string().trim().max(max, t("fieldTooLong", { label })).nullable(),
  );
}

// Tipo de necesidad (member/mentor/tester). Valor por defecto member cuando el
// formulario no lo envía (retrocompatible).
export function createProjectNeedKindSchema(t: ValidationTranslator) {
  return z.preprocess(
    (value) =>
      typeof value !== "string" || value.trim() === "" ? "member" : value,
    z.enum(NEED_KINDS, { error: t("needKindInvalid") }),
  );
}

// Señal de inversión del proyecto (FASE 7): flag + datos opcionales. Si el
// flag va apagado, todo se limpia a NULL (espejo de projects_funding_signal_check).
export function createProjectFundingSchema(t: ValidationTranslator) {
  return z
    .object({
      seeking_investment: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
      funding_stage: z.preprocess(
        (value) => (typeof value !== "string" || value.trim() === "" ? null : value),
        z.enum(FUNDING_STAGES, { error: t("fundingStageInvalid") }).nullable(),
      ),
      amount_sought: z.preprocess(
        (value) => {
          if (typeof value !== "string" || value.trim() === "") {
            return null;
          }
          const parsed = Number(value.replace(",", "."));
          return Number.isFinite(parsed) ? parsed : value;
        },
        z
          .number({ error: t("fundingAmountInvalid") })
          .min(0, t("fundingAmountInvalid"))
          .max(FUNDING_AMOUNT_MAX, t("fundingAmountInvalid"))
          .nullable(),
      ),
      investment_currency: z.preprocess(
        (value) =>
          typeof value !== "string" || value.trim() === "" ? null : value,
        z.string().regex(/^[A-Z]{3}$/, t("currencyInvalid")).nullable(),
      ),
      investment_note: optionalText(t, "investmentNote", 2000),
    })
    .transform((data) => ({
      seeking_investment: data.seeking_investment,
      funding_stage: data.seeking_investment ? data.funding_stage : null,
      amount_sought: data.seeking_investment ? data.amount_sought : null,
      investment_currency: data.seeking_investment ? data.investment_currency : null,
      investment_note: data.seeking_investment ? data.investment_note : null,
    }));
}

// Plan de primeros usuarios (FASE 7): declaración simple, sin sistema de
// testing. what_to_test es el único campo obligatorio.
export function createPilotPlanSchema(t: ValidationTranslator) {
  return z.object({
    what_to_test: createRequiredTextSchema(t, "pilotWhatToTest", 10, 1000),
    target_user_profile: optionalText(t, "pilotTargetProfile", 500),
    tester_expectations: optionalText(t, "pilotExpectations", 1000),
    incentive_note: optionalText(t, "pilotIncentive", 300),
    slots_total: z.preprocess(
      (value) => {
        if (typeof value !== "string" || value.trim() === "") {
          return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      },
      z
        .number({ error: t("pilotSlotsInvalid") })
        .int(t("pilotSlotsInvalid"))
        .min(1, t("pilotSlotsInvalid"))
        .max(10000, t("pilotSlotsInvalid"))
        .nullable(),
    ),
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
export type ProjectNeedKind = z.infer<ReturnType<typeof createProjectNeedKindSchema>>;
export type ProjectFundingInput = z.infer<ReturnType<typeof createProjectFundingSchema>>;
export type PilotPlanInput = z.infer<ReturnType<typeof createPilotPlanSchema>>;
