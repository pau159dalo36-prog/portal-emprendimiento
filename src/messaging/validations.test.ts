import { describe, expect, it } from "vitest";

import {
  conversationIdSchema,
  createMessageSchema,
  targetProfileIdSchema,
} from "@/messaging/validations";

describe("messaging — validaciones (espejo de los CHECKs SQL)", () => {
  it("acepta y recorta un cuerpo válido", () => {
    const parsed = createMessageSchema().parse({ body: "  hola que tal  " });
    expect(parsed.body).toBe("hola que tal");
  });

  it("rechaza el cuerpo vacío o solo espacios", () => {
    expect(createMessageSchema().safeParse({ body: "" }).success).toBe(false);
    expect(createMessageSchema().safeParse({ body: "    " }).success).toBe(false);
    expect(createMessageSchema().safeParse({}).success).toBe(false);
  });

  it("rechaza cuerpos por encima de 2000 caracteres tras trim", () => {
    const limit = createMessageSchema().safeParse({ body: "x".repeat(2000) });
    expect(limit.success).toBe(true);

    const over = createMessageSchema().safeParse({ body: `  ${"x".repeat(2001)} ` });
    expect(over.success).toBe(false);
  });

  it("targetProfileIdSchema exige UUID", () => {
    expect(targetProfileIdSchema.safeParse("00000000-0000-4000-8000-000000000001").success).toBe(
      true,
    );
    expect(targetProfileIdSchema.safeParse("no-uuid").success).toBe(false);
    expect(targetProfileIdSchema.safeParse(null).success).toBe(false);
  });

  it("conversationIdSchema exige UUID", () => {
    expect(conversationIdSchema.safeParse("00000000-0000-4000-8000-000000000002").success).toBe(
      true,
    );
    expect(conversationIdSchema.safeParse("otra-cosa").success).toBe(false);
  });
});
