import { describe, expect, test } from "vitest";
import type { ValidationTranslator } from "@/validations/auth";
import { createVideoSchema } from "@/validations/video";

const t: ValidationTranslator = (key) => key;

const VALID_PUBLICATION = {
  title: "Demo de mi proyecto",
  caption: "Así se ve la app en acción",
  original_language: "es",
  visibility: "public",
  project_id: null,
};

describe("createVideoSchema", () => {
  test("acepta un vídeo válido", () => {
    const result = createVideoSchema(t).safeParse(VALID_PUBLICATION);
    expect(result.success).toBe(true);
  });

  test("acepta un proyecto asociado", () => {
    const result = createVideoSchema(t).safeParse({
      ...VALID_PUBLICATION,
      project_id: "b8e7f2b4-1f2a-4c3d-8e5f-6a7b8c9d0e1f",
    });
    expect(result.success).toBe(true);
  });

  test("rechaza un título demasiado corto", () => {
    const result = createVideoSchema(t).safeParse({
      ...VALID_PUBLICATION,
      title: "x",
    });
    expect(result.success).toBe(false);
  });

  test("rechaza un título demasiado largo", () => {
    const result = createVideoSchema(t).safeParse({
      ...VALID_PUBLICATION,
      title: "a".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  test("rechaza una visibilidad no válida", () => {
    const result = createVideoSchema(t).safeParse({
      ...VALID_PUBLICATION,
      visibility: "everyone",
    });
    expect(result.success).toBe(false);
  });

  test("rechaza un idioma no válido", () => {
    const result = createVideoSchema(t).safeParse({
      ...VALID_PUBLICATION,
      original_language: "fr",
    });
    expect(result.success).toBe(false);
  });

  test("rechaza un project_id que no es uuid", () => {
    const result = createVideoSchema(t).safeParse({
      ...VALID_PUBLICATION,
      project_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
