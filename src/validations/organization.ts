import { z } from "zod";
import type { ValidationTranslator } from "@/validations/auth";
import { INDUSTRIES, MAX_INDUSTRIES, ORGANIZATION_LINK_TYPES, ORGANIZATION_MEMBER_ROLES } from "@/organizations/constants";
import {
  createEnumArraySchema,
  createIsCheckedSchema,
  createOptionalTextSchema,
  createOptionalUrlSchema,
  createRequiredTextSchema,
  createSlugSchema,
} from "@/validations/fields";

export function createOrganizationSlugSchema(t: ValidationTranslator) {
  return createSlugSchema(t, {
    min: 3,
    max: 30,
    minKey: "orgSlugMin",
    maxKey: "orgSlugMax",
    charsKey: "slugChars",
  });
}

export function createOrganizationSchema(t: ValidationTranslator) {
  return z.object({
    name: createRequiredTextSchema(t, "orgName", 2, 120),
    slug: createOrganizationSlugSchema(t),
    headline: createOptionalTextSchema(t, "orgHeadline", 120),
    description: createOptionalTextSchema(t, "orgDescription", 5000),
    location: createOptionalTextSchema(t, "orgLocation", 120),
    industries: createEnumArraySchema(INDUSTRIES).max(
      MAX_INDUSTRIES,
      t("maxItems", { count: MAX_INDUSTRIES, label: t("labels.industries") }),
    ),
    website_url: createOptionalUrlSchema(t),
    contact_email: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.email(t("emailInvalid")).nullable(),
    ),
    is_public: createIsCheckedSchema(),
  });
}

export function createOrganizationLinkSchema(t: ValidationTranslator) {
  return z.object({
    link_type: z.enum(ORGANIZATION_LINK_TYPES, { error: t("linkTypeInvalid") }),
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

export function createMemberUsernameSchema(t: ValidationTranslator) {
  return z.string().trim().toLowerCase().min(1, t("requiredField", { label: t("labels.memberUsername") }));
}

export function createOrganizationMemberRoleSchema(t: ValidationTranslator) {
  return z.enum(ORGANIZATION_MEMBER_ROLES, { error: t("roleInvalid") });
}

export type OrganizationInput = z.infer<ReturnType<typeof createOrganizationSchema>>;
export type OrganizationLinkInput = z.infer<ReturnType<typeof createOrganizationLinkSchema>>;
