import { describe, expect, test } from "vitest";
import type { ValidationTranslator } from "@/validations/auth";
import {
  createProjectLinkSchema,
  createProjectNeedSchema,
  createProjectSchema,
  createProjectUpdateSchema,
} from "@/validations/project";

const t: ValidationTranslator = (key) => key;

const VALID_PROJECT = {
  name: "App de viajes",
  slug: "app-viajes",
  tagline: null,
  description: null,
  problem: null,
  solution: null,
  target_market: null,
  traction: null,
  stage: "idea",
  industries: ["tecnologia"],
  website_url: null,
  cover_image_url: null,
  is_public: false,
};

describe("createProjectSchema", () => {
  test("acepta un proyecto válido", () => {
    const result = createProjectSchema(t).safeParse(VALID_PROJECT);
    expect(result.success).toBe(true);
  });

  test("rechaza una etapa no válida", () => {
    const result = createProjectSchema(t).safeParse({ ...VALID_PROJECT, stage: "produccion" });
    expect(result.success).toBe(false);
  });

  test("rechaza un slug demasiado largo", () => {
    const result = createProjectSchema(t).safeParse({
      ...VALID_PROJECT,
      slug: "a".repeat(61),
    });
    expect(result.success).toBe(false);
  });
});

describe("createProjectUpdateSchema", () => {
  test("acepta organización y estado", () => {
    const result = createProjectUpdateSchema(t).safeParse({
      ...VALID_PROJECT,
      organization_id: null,
      status: "published",
    });
    expect(result.success).toBe(true);
  });

  test("rechaza un estado no válido", () => {
    const result = createProjectUpdateSchema(t).safeParse({
      ...VALID_PROJECT,
      organization_id: null,
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });
});

describe("createProjectLinkSchema", () => {
  test("acepta un enlace válido", () => {
    const result = createProjectLinkSchema(t).safeParse({
      link_type: "github",
      label: "Repositorio",
      url: "https://github.com/acme",
    });
    expect(result.success).toBe(true);
  });
});

describe("createProjectNeedSchema", () => {
  test("acepta una necesidad con título y descripción", () => {
    const result = createProjectNeedSchema(t).safeParse({
      title: "Desarrollador/a full-stack",
      description: "React y Supabase",
      commitment: "10 h/semana",
    });
    expect(result.success).toBe(true);
  });

  test("rechaza una necesidad sin título", () => {
    const result = createProjectNeedSchema(t).safeParse({
      title: "",
      description: null,
      commitment: null,
    });
    expect(result.success).toBe(false);
  });
});
