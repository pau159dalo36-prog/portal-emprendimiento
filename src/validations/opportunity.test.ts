// Tests de validación del formulario de oportunidades. El traductor devuelve la
// clave (t: (key) => key) para poder asertar el mensaje exacto por campo.
import { describe, expect, it } from "vitest";
import type { ValidationTranslator } from "@/validations/auth";
import { createOpportunitySchema } from "@/validations/opportunity";

const t: ValidationTranslator = (key) => key;

const BASE = {
  title: "Prácticas de ingeniería",
  description: "Buscamos a una persona con ganas de aprender junto al equipo.",
  opportunity_type: "job",
  employment_type: "full_time",
  experience_level: null,
  work_mode: "hybrid",
  industry: "tecnologia",
  country: "ES",
  region: null,
  city: "Madrid",
  location_text: null,
  status: "draft",
  visibility: "public",
  is_first_job_friendly: false,
  is_student_friendly: false,
  compensation_type: "negotiable",
  compensation_min: null,
  compensation_max: null,
  currency: null,
  compensation_period: null,
  starts_at: null,
  ends_at: null,
  slots_total: null,
  closes_at: null,
  project_id: null,
  organization_id: null,
};

describe("createOpportunitySchema", () => {
  it("acepta un empleo válido en borrador", () => {
    const result = createOpportunitySchema(t).safeParse(BASE);
    expect(result.success).toBe(true);
  });

  it("acepta un turno de un día válido", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      opportunity_type: "one_day_shift",
      employment_type: null,
      work_mode: null,
      compensation_type: "monetary",
      compensation_min: "60",
      compensation_max: "90",
      currency: "EUR",
      compensation_period: "shift",
      starts_at: "2026-08-20T09:00",
      ends_at: "2026-08-20T17:00",
      slots_total: "5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employment_type).toBeNull();
      expect(result.data.slots_total).toBe(5);
    }
  });

  it("compensation_type vacío cae a negociable por defecto", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      compensation_type: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.compensation_type).toBe("negotiable");
    }
  });

  it("rechaza un empleo sin employment_type", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      employment_type: null,
      work_mode: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "employment_type")).toBe(true);
      expect(result.error.issues.find((issue) => issue.path[0] === "employment_type")?.message).toBe(
        "employmentRequired",
      );
    }
  });

  it("rechaza un turno que termina antes de empezar", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      opportunity_type: "one_day_shift",
      employment_type: null,
      work_mode: null,
      compensation_type: "monetary",
      compensation_min: "60",
      currency: "EUR",
      compensation_period: "shift",
      starts_at: "2026-08-20T17:00",
      ends_at: "2026-08-20T09:00",
      slots_total: "2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "endsBeforeStarts")).toBe(true);
    }
  });

  it("rechaza publicar un turno ya terminado", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      opportunity_type: "one_day_shift",
      employment_type: null,
      work_mode: null,
      compensation_type: "unpaid",
      status: "published",
      starts_at: "2020-01-01T09:00",
      ends_at: "2020-01-01T17:00",
      slots_total: "2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "pastShift")).toBe(true);
    }
  });

  it("rechaza compensación monetaria sin moneda", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      compensation_type: "monetary",
      compensation_min: "1000",
      currency: null,
      compensation_period: "month",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "currency")).toBe(true);
    }
  });

  it("rechaza una fecha de inicio inválida con su mensaje", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      starts_at: "no-es-una-fecha",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "starts_at");
      expect(issue?.message).toBe("startsInvalid");
    }
  });

  it("rechaza una fecha de fin inválida con su mensaje", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      ends_at: "no-es-una-fecha",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "ends_at");
      expect(issue?.message).toBe("endsInvalid");
    }
  });

  it("rechaza una fecha de cierre inválida con su mensaje", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      closes_at: "no-es-una-fecha",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "closes_at");
      expect(issue?.message).toBe("closesInvalid");
    }
  });

  it("normaliza el turno a null cuando no es un turno de un día", () => {
    const result = createOpportunitySchema(t).safeParse({
      ...BASE,
      starts_at: "2026-08-20T09:00",
      ends_at: "2026-08-20T17:00",
      slots_total: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.starts_at).toBeNull();
      expect(result.data.slots_total).toBeNull();
    }
  });
});
