import type { Database } from "@/types/database.types";

export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

export type OrganizationFormData = {
  name: string;
  slug: string;
  headline: string;
  description: string;
  location: string;
  industries: string[];
  website_url: string;
  contact_email: string;
  is_public: boolean;
};

export const emptyOrganizationFormData: OrganizationFormData = {
  name: "",
  slug: "",
  headline: "",
  description: "",
  location: "",
  industries: [],
  website_url: "",
  contact_email: "",
  is_public: true,
};

export function toOrganizationFormData(
  organization: OrganizationRow | null,
): OrganizationFormData {
  if (!organization) {
    return emptyOrganizationFormData;
  }
  return {
    name: organization.name,
    slug: organization.slug,
    headline: organization.headline ?? "",
    description: organization.description ?? "",
    location: organization.location ?? "",
    industries: organization.industries,
    website_url: organization.website_url ?? "",
    contact_email: organization.contact_email ?? "",
    is_public: organization.is_public,
  };
}
