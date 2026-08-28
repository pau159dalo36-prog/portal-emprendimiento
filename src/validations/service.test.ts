// Tests de validación del formulario de servicios (FASE 7). El traductor
// devuelve la clave para poder asertar el mensaje exacto por campo. La forma
// de los campos de precio depende de pricing_type, espejo del CHECK
// services_pricing_shape_check de la migración.
import { describe, expect, it } from "vitest";
import type { ValidationTranslator } from "@/validations/auth";
import { createServiceSchema } from "@/services/schemas";

const t: ValidationTranslator = (key) => key;

const BASE = {
  title: "Desarrollo de landing pages",
  description: "Creo landing pages rápidas y accesibles para validar tu idea.",
  category: "desarrollo_web",
  delivery_mode: "remote",
  pricing_type: "negotiable",
  status: "draft",
  visibility: "public",
  price_amount: null,
  price_min: null,
  price_max: null,
  currency: null,
};

describe("createServiceSchema — pricing", () => {
  it("acepta un servicio negotiable sin importes ni moneda", () => {
    const result = createServiceSchema(t).safeParse(BASE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_amount).toBeNull();
      expect(result.data.currency).toBeNull();
    }
  });

  it("acepta un precio fijo con moneda", () => {
    const result = createServiceSchema(t).safeParse({
      ...BASE,
      pricing_type: "fixed",
      price_amount: "500",
      currency: "EUR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_amount).toBe(500);
      expect(result.data.price_min).toBeNull();
      expect(result.data.price_max).toBeNull();
      expect(result.data.currency).toBe("EUR");
    }
  });

  it("acepta un precio por hora con moneda", () => {
    const result = createServiceSchema(t).safeParse({
      ...BASE,
      pricing_type: "hourly",
      price_amount: "35,5",
      currency: "USD",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_amount).toBe(35.5);
      expect(result.data.currency).toBe("USD");
    }
  });

  it("exige importe y moneda en fixed", () => {
    const result = createServiceSchema(t).safeParse({
      ...BASE,
      pricing_type: "fixed",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.price_amount).toContain("amountRequired");
      expect(fields.currency).toContain("currencyRequired");
    }
  });

  it("exige min <= max en range", () => {
    const ok = createServiceSchema(t).safeParse({
      ...BASE,
      pricing_type: "range",
      price_min: "100",
      price_max: "200",
      currency: "EUR",
    });
    expect(ok.success).toBe(true);

    const bad = createServiceSchema(t).safeParse({
      ...BASE,
      pricing_type: "range",
      price_min: "300",
      price_max: "200",
      currency: "EUR",
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.flatten().fieldErrors.price_max).toContain("maxBelowMin");
    }

    const missing = createServiceSchema(t).safeParse({
      ...BASE,
      pricing_type: "range",
      price_max: "200",
      currency: "EUR",
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.flatten().fieldErrors.price_min).toContain("rangeRequired");
    }
  });

  it("prohíbe importes en free/negotiable", () => {
    const result = createServiceSchema(t).safeParse({
      ...BASE,
      pricing_type: "free",
      price_amount: "10",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.price_amount).toContain("noAmountsForType");
    }
  });

  it("rechaza monedas que no son ISO-4217 de 3 letras", () => {
    const result = createServiceSchema(t).safeParse({
      ...BASE,
      pricing_type: "fixed",
      price_amount: "10",
      currency: "euro",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.currency).toContain("currencyInvalid");
    }
  });

  it("rechaza importes negativos", () => {
    const result = createServiceSchema(t).safeParse({
      ...BASE,
      pricing_type: "fixed",
      price_amount: "-1",
      currency: "EUR",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.price_amount).toContain("amountInvalid");
    }
  });
});

describe("createServiceSchema — campos base", () => {
  it("rechaza títulos demasiado cortos o largos", () => {
    expect(
      createServiceSchema(t).safeParse({ ...BASE, title: "ab" }).success,
    ).toBe(false);
    expect(
      createServiceSchema(t).safeParse({ ...BASE, title: "a".repeat(121) }).success,
    ).toBe(false);
  });

  it("exige una descripción mínima de 20 caracteres", () => {
    const result = createServiceSchema(t).safeParse({ ...BASE, description: "muy corto" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.description).toContain("descriptionTooShort");
    }
  });

  it("rechaza categoría, modalidad, visibilidad o estado no válidos", () => {
    expect(createServiceSchema(t).safeParse({ ...BASE, category: "crypto" }).success).toBe(false);
    expect(createServiceSchema(t).safeParse({ ...BASE, delivery_mode: "telepatia" }).success).toBe(false);
    expect(createServiceSchema(t).safeParse({ ...BASE, visibility: "unlisted" }).success).toBe(false);
    // El ciclo solo permite crear como draft o published.
    expect(createServiceSchema(t).safeParse({ ...BASE, status: "paused" }).success).toBe(false);
  });

  it("normaliza el estado publicado sin tocar el borrador", () => {
    const published = createServiceSchema(t).safeParse({ ...BASE, status: "published" });
    expect(published.success).toBe(true);
    if (published.success) {
      expect(published.data.status).toBe("published");
    }
  });
});
