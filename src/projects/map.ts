import type { Database } from "@/types/database.types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type ProjectFormData = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  problem: string;
  solution: string;
  target_market: string;
  traction: string;
  stage: string;
  industries: string[];
  website_url: string;
  cover_image_url: string;
  is_public: boolean;
  organization_id: string;
  status: string;
};

export const emptyProjectFormData: ProjectFormData = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  problem: "",
  solution: "",
  target_market: "",
  traction: "",
  stage: "idea",
  industries: [],
  website_url: "",
  cover_image_url: "",
  is_public: false,
  organization_id: "",
  status: "draft",
};

export function toProjectFormData(project: ProjectRow | null): ProjectFormData {
  if (!project) {
    return emptyProjectFormData;
  }
  return {
    name: project.name,
    slug: project.slug,
    tagline: project.tagline ?? "",
    description: project.description ?? "",
    problem: project.problem ?? "",
    solution: project.solution ?? "",
    target_market: project.target_market ?? "",
    traction: project.traction ?? "",
    stage: project.stage,
    industries: project.industries,
    website_url: project.website_url ?? "",
    cover_image_url: project.cover_image_url ?? "",
    is_public: project.is_public,
    organization_id: project.organization_id ?? "",
    status: project.status,
  };
}
