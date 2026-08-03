import { describe, expect, test } from "vitest";
import type { ValidationTranslator } from "@/validations/auth";
import {
  createOrganizationLinkSchema,
  createOrganizationSchema,
  createOrganizationSlugSchema,
} from "@/validations/organization";

const t: ValidationTranslator = (key) => key;

describe("createOrganizationSchema", () => {
  test("acepta una organización válida", () => {
    const result = createOrganizationSchema(t).safeParse({
      name: "Acme Tech",
      slug: "acme-tech",
      headline: "Innovación",
      description: null,
      location: null,
      industries: ["tecnologia", "energia"],
      website_url: null,
      contact_email: "hola@acme.com",
      is_public: true,
    });
    expect(result.success).toBe(true);
  });

  test("rechaza un nombre vacío", () => {
    const result = createOrganizationSchema(t).safeParse({
      name: "  ",
      slug: "acme-tech",
      headline: null,
      description: null,
      location: null,
      industries: [],
      website_url: null,
      contact_email: null,
      is_public: true,
    });
    expect(result.success).toBe(false);
  });

  test("normaliza el slug a minúsculas", () => {
    const result = createOrganizationSchema(t).safeParse({
      name: "Acme",
      slug: "Acme-Tech",
      headline: null,
      description: null,
      location: null,
      industries: [],
      website_url: null,
      contact_email: null,
      is_public: true,
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.slug).toBe("acme-tech");
  });

  test("rechaza más de 5 sectores", () => {
    const result = createOrganizationSchema(t).safeParse({
      name: "Acme",
      slug: "acme",
      headline: null,
      description: null,
      location: null,
      industries: ["tecnologia", "salud", "educacion", "finanzas", "energia", "retail"],
      website_url: null,
      contact_email: null,
      is_public: true,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza una URL de sitio web no válida", () => {
    const result = createOrganizationSchema(t).safeParse({
      name: "Acme",
      slug: "acme",
      headline: null,
      description: null,
      location: null,
      industries: [],
      website_url: "ftp://acme.com",
      contact_email: null,
      is_public: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("createOrganizationSlugSchema", () => {
  test("acepta un slug válido", () => {
    const result = createOrganizationSlugSchema(t).safeParse("acme-tech_1");
    expect(result.success).toBe(true);
  });

  test("rechaza un slug demasiado corto", () => {
    const result = createOrganizationSlugSchema(t).safeParse("ab");
    expect(result.success).toBe(false);
  });

  test("normaliza a minúsculas", () => {
    const result = createOrganizationSlugSchema(t).safeParse("ACME");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe("acme");
  });
});

describe("createOrganizationLinkSchema", () => {
  test("acepta un enlace válido", () => {
    const result = createOrganizationLinkSchema(t).safeParse({
      link_type: "website",
      label: "Sitio web",
      url: "https://acme.com",
    });
    expect(result.success).toBe(true);
  });

  test("rechaza una URL sin protocolo", () => {
    const result = createOrganizationLinkSchema(t).safeParse({
      link_type: "website",
      label: "Sitio web",
      url: "acme.com",
    });
    expect(result.success).toBe(false);
  });
});
