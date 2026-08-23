import { z } from "zod";

import {
  COMPENSATION_PERIODS,
  COMPENSATION_TYPES,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  OPPORTUNITY_COMPENSATION_MAX_VALUE,
  OPPORTUNITY_SLOTS_MAX,
  OPPORTUNITY_SLOTS_MIN,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_VISIBILITIES,
  ONE_DAY_COMPENSATION_PERIODS,
  WORK_MODES,
} from "@/opportunities/constants";
import { toIsoDateTime } from "@/opportunities/map";
import { INDUSTRIES } from "@/organizations/constants";
import type { ValidationTranslator } from "@/validations/auth";

function emptyToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

// datetime-local ("YYYY-MM-DDTHH:mm", hora local) → ISO-8601 UTC. Un valor
// inválido pasa tal cual para que el refine lo rechace con mensaje claro.
function toIsoOrKeep(value: unknown): unknown {
  if (typeof value !== "string" || value.trim() === "") {
    return value;
  }
  return toIsoDateTime(value) ?? value;
}

function optionalEnum<T extends readonly [string, ...string[]]>(
  values: T,
  invalidKey: string,
  t: ValidationTranslator,
) {
  return z.preprocess(emptyToNull, z.enum(values, { error: t(invalidKey) }).nullable());
}

function optionalNumber(
  min: number,
  max: number,
  invalidKey: string,
  t: ValidationTranslator,
) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string" || value.trim() === "") {
        return null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    },
    z.number({ error: t(invalidKey) }).min(min, t(invalidKey)).max(max, t(invalidKey)).nullable(),
  );
}

function optionalUuid(t: ValidationTranslator) {
  return z.preprocess(emptyToNull, z.string().uuid(t("uuidInvalid")).nullable());
}

// Fecha de formulario: datetime-local ("YYYY-MM-DDTHH:mm") convertida a ISO-8601
// UTC. Un string que no es una fecha válida falla aquí con mensaje claro (un
// valor inválido que llegara a la BD rompería la fila timestamptz).
function dateField(t: ValidationTranslator, invalidKey: string) {
  return z
    .preprocess(toIsoOrKeep, z.string().nullable())
    .refine(
      (value) =>
        value === null || value.trim() === "" || !Number.isNaN(new Date(value).getTime()),
      { error: t(invalidKey) },
    );
}

export function createOpportunitySchema(t: ValidationTranslator) {
  const isChecked = z.preprocess((value) => value === "on", z.boolean());

  const base = z.object({
    title: z.string().trim().min(3, t("titleTooShort")).max(200, t("titleTooLong")),
    description: z
      .string()
      .trim()
      .min(10, t("descriptionTooShort"))
      .max(5000, t("descriptionTooLong")),
    opportunity_type: z.enum(OPPORTUNITY_TYPES, { error: t("typeInvalid") }),
    employment_type: optionalEnum(EMPLOYMENT_TYPES, "employmentInvalid", t),
    experience_level: optionalEnum(EXPERIENCE_LEVELS, "experienceInvalid", t),
    work_mode: optionalEnum(WORK_MODES, "workModeInvalid", t),
    industry: optionalEnum(INDUSTRIES, "industryInvalid", t),
    country: z.preprocess(
      emptyToNull,
      z.string().trim().max(120, t("fieldTooLong")).nullable(),
    ),
    region: z.preprocess(
      emptyToNull,
      z.string().trim().max(120, t("fieldTooLong")).nullable(),
    ),
    city: z.preprocess(
      emptyToNull,
      z.string().trim().max(120, t("fieldTooLong")).nullable(),
    ),
    location_text: z.preprocess(
      emptyToNull,
      z.string().trim().max(200, t("locationTextTooLong")).nullable(),
    ),
    status: z.enum(["draft", "published"], { error: t("statusInvalid") }),
    visibility: z.enum(OPPORTUNITY_VISIBILITIES, { error: t("visibilityInvalid") }),
    is_first_job_friendly: isChecked,
    is_student_friendly: isChecked,
    compensation_type: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? "negotiable" : value,
      z.enum(COMPENSATION_TYPES, { error: t("compensationTypeInvalid") }),
    ),
    compensation_min: optionalNumber(0, OPPORTUNITY_COMPENSATION_MAX_VALUE, "minInvalid", t),
    compensation_max: optionalNumber(0, OPPORTUNITY_COMPENSATION_MAX_VALUE, "maxInvalid", t),
    currency: z.preprocess(emptyToNull, z.string().regex(/^[A-Z]{3}$/, t("currencyInvalid")).nullable()),
    compensation_period: optionalEnum(COMPENSATION_PERIODS, "compensationPeriodInvalid", t),
    starts_at: dateField(t, "startsInvalid"),
    ends_at: dateField(t, "endsInvalid"),
    slots_total: optionalNumber(OPPORTUNITY_SLOTS_MIN, OPPORTUNITY_SLOTS_MAX, "slotsInvalid", t),
    closes_at: dateField(t, "closesInvalid"),
    project_id: optionalUuid(t),
    organization_id: optionalUuid(t),
  });

  return base
    .superRefine((data, ctx) => {
      const isEmploymentType =
        data.opportunity_type === "job" || data.opportunity_type === "internship";
      if (isEmploymentType) {
        if (data.employment_type === null) {
          ctx.addIssue({ code: "custom", path: ["employment_type"], message: t("employmentRequired") });
        }
        if (data.work_mode === null) {
          ctx.addIssue({ code: "custom", path: ["work_mode"], message: t("workModeRequired") });
        }
      } else if (data.employment_type !== null) {
        ctx.addIssue({ code: "custom", path: ["employment_type"], message: t("noEmploymentForType") });
      }

      const isShift = data.opportunity_type === "one_day_shift";
      if (isShift) {
        if (data.starts_at === null) {
          ctx.addIssue({ code: "custom", path: ["starts_at"], message: t("startsRequired") });
        }
        if (data.ends_at === null) {
          ctx.addIssue({ code: "custom", path: ["ends_at"], message: t("endsRequired") });
        }
        if (data.slots_total === null) {
          ctx.addIssue({ code: "custom", path: ["slots_total"], message: t("slotsRequired") });
        }
        if (
          data.starts_at !== null &&
          data.ends_at !== null &&
          new Date(data.starts_at).getTime() >= new Date(data.ends_at).getTime()
        ) {
          ctx.addIssue({ code: "custom", path: ["ends_at"], message: t("endsBeforeStarts") });
        }
        if (data.status === "published" && data.ends_at !== null) {
          const end = new Date(data.ends_at).getTime();
          if (!Number.isNaN(end) && end <= Date.now()) {
            ctx.addIssue({ code: "custom", path: ["ends_at"], message: t("pastShift") });
          }
        }
      }

      const isMonetary = data.compensation_type === "monetary";
      if (isMonetary) {
        if (data.compensation_period === null) {
          ctx.addIssue({ code: "custom", path: ["compensation_period"], message: t("compensationPeriodRequired") });
        }
        if (data.currency === null) {
          ctx.addIssue({ code: "custom", path: ["currency"], message: t("currencyRequired") });
        }
        if (data.compensation_min === null && data.compensation_max === null) {
          ctx.addIssue({ code: "custom", path: ["compensation_min"], message: t("rangeRequired") });
        }
        if (
          data.compensation_min !== null &&
          data.compensation_max !== null &&
          data.compensation_min > data.compensation_max
        ) {
          ctx.addIssue({ code: "custom", path: ["compensation_max"], message: t("maxBelowMin") });
        }
        if (isShift && data.compensation_period !== null) {
          const periods = ONE_DAY_COMPENSATION_PERIODS as readonly string[];
          if (!periods.includes(data.compensation_period)) {
            ctx.addIssue({ code: "custom", path: ["compensation_period"], message: t("oneDayPeriodInvalid") });
          }
        }
      }
    })
    .transform((data) => {
      const isEmploymentType =
        data.opportunity_type === "job" || data.opportunity_type === "internship";
      const isShift = data.opportunity_type === "one_day_shift";
      const isMonetary = data.compensation_type === "monetary";
      return {
        ...data,
        employment_type: isEmploymentType ? data.employment_type : null,
        work_mode: isEmploymentType ? data.work_mode : null,
        starts_at: isShift ? data.starts_at : null,
        ends_at: isShift ? data.ends_at : null,
        slots_total: isShift ? data.slots_total : null,
        compensation_min: isMonetary ? data.compensation_min : null,
        compensation_max: isMonetary ? data.compensation_max : null,
        currency: isMonetary ? data.currency : null,
        compensation_period: isMonetary ? data.compensation_period : null,
      };
    });
}

export function createOpportunityStatusSchema(t: ValidationTranslator) {
  return z.enum(OPPORTUNITY_STATUSES, { error: t("statusInvalid") });
}

export function createOpportunityModerationSchema(t: ValidationTranslator) {
  return z.object({
    intent: z.enum(["approve", "reject", "flag"], { error: t("invalidIntent") }),
    reason: z
      .preprocess((value) => (typeof value === "string" && value.trim() === "" ? null : value), z.string().nullable())
      .refine((reason) => reason === null || reason.length <= 500, {
        error: t("reasonTooLong"),
      }),
  });
}

export type OpportunityInput = z.infer<ReturnType<typeof createOpportunitySchema>>;
export type OpportunityModerationInput = z.infer<ReturnType<typeof createOpportunityModerationSchema>>;
