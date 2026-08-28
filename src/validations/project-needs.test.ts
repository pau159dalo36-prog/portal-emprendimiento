// Tests de las validaciones FASE 7 sobre proyectos: señal de inversión,
// plan de primeros usuarios y tipo de necesidad (mentor/tester).
import { describe, expect, it } from "vitest";
import type { ValidationTranslator } from "@/validations/auth";
import {
  createPilotPlanSchema,
  createProjectFundingSchema,
  createProjectNeedKindSchema,
} from "@/validations/project";

const t: ValidationTranslator = (key) => key;

describe("createProjectFundingSchema", () => {
  it("con el flag apagado limpia todos los campos a NULL", () => {
    const result = createProjectFundingSchema(t).safeParse({
      seeking_investment: "off",
      funding_stage: "seed",
      amount_sought: "50000",
      investment_currency: "EUR",
      investment_note: "Nota",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        seeking_investment: false,
        funding_stage: null,
        amount_sought: null,
        investment_currency: null,
        investment_note: null,
      });
    }
  });

  it("acepta una señal mínima: solo el flag activado", () => {
    const result = createProjectFundingSchema(t).safeParse({ seeking_investment: "on" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.seeking_investment).toBe(true);
      expect(result.data.funding_stage).toBeNull();
    }
  });

  it("conserva los datos cuando la búsqueda está activa", () => {
    const result = createProjectFundingSchema(t).safeParse({
      seeking_investment: "true",
      funding_stage: "pre_seed",
      amount_sought: "25000",
      investment_currency: "EUR",
      investment_note: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.funding_stage).toBe("pre_seed");
      expect(result.data.amount_sought).toBe(25000);
      expect(result.data.investment_currency).toBe("EUR");
      expect(result.data.investment_note).toBeNull();
    }
  });

  it("rechaza etapas y monedas no válidas", () => {
    const badStage = createProjectFundingSchema(t).safeParse({
      seeking_investment: "true",
      funding_stage: "ico",
    });
    expect(badStage.success).toBe(false);

    const badCurrency = createProjectFundingSchema(t).safeParse({
      seeking_investment: "true",
      investment_currency: "euros",
    });
    expect(badCurrency.success).toBe(false);

    const badAmount = createProjectFundingSchema(t).safeParse({
      seeking_investment: "true",
      amount_sought: "-5",
    });
    expect(badAmount.success).toBe(false);
  });
});

describe("createPilotPlanSchema", () => {
  const BASE = { what_to_test: "El flujo de registro paso a paso" };

  it("acepta un plan mínimo con solo qué probar", () => {
    const result = createPilotPlanSchema(t).safeParse(BASE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slots_total).toBeNull();
    }
  });

  it("rechaza qué-probar demasiado corto", () => {
    const result = createPilotPlanSchema(t).safeParse({ what_to_test: "corto" });
    expect(result.success).toBe(false);
  });

  it("exige plazas enteras positivas si se indican", () => {
    expect(
      createPilotPlanSchema(t).safeParse({ ...BASE, slots_total: "10" }).success,
    ).toBe(true);
    expect(
      createPilotPlanSchema(t).safeParse({ ...BASE, slots_total: "0" }).success,
    ).toBe(false);
    expect(
      createPilotPlanSchema(t).safeParse({ ...BASE, slots_total: "2.5" }).success,
    ).toBe(false);
  });
});

describe("createProjectNeedKindSchema", () => {
  it("aplica member por defecto (retrocompatible)", () => {
    const result = createProjectNeedKindSchema(t).safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("member");
    }
  });

  it("acepta mentor y tester; rechaza valores desconocidos", () => {
    expect(createProjectNeedKindSchema(t).safeParse("mentor").success).toBe(true);
    expect(createProjectNeedKindSchema(t).safeParse("tester").success).toBe(true);
    expect(createProjectNeedKindSchema(t).safeParse("investor").success).toBe(false);
  });
});
