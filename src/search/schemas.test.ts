import { describe, expect, it } from "vitest";

import { SEARCH_PAGE_SIZE } from "@/search/config";
import {
  normalizeQuery,
  parseCursor,
  resolveLimit,
  searchLimitSchema,
  searchSortSchema,
  serializeCursor,
} from "@/search/schemas";

describe("cursor serialize/parse", () => {
  const cursor = { score: 0.85, createdAt: "2026-08-15T10:00:00.000Z", id: "abc-123" };

  it("es opaco y reversible", () => {
    const raw = serializeCursor(cursor);
    expect(parseCursor(raw)).toEqual(cursor);
  });

  it("rechaza cursors corruptos", () => {
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor(undefined)).toBeNull();
    expect(parseCursor("")).toBeNull();
    expect(parseCursor("no-json")).toBeNull();
    expect(parseCursor(JSON.stringify({ v: 999, s: 1, t: "x", i: "y" }))).toBeNull();
    expect(parseCursor(JSON.stringify({ v: 1, t: "x", i: "y" }))).toBeNull();
  });
});

describe("normalizeQuery", () => {
  it("recorta espacios y trunca a 200 caracteres", () => {
    expect(normalizeQuery("  motor   ")).toBe("motor");
    expect(normalizeQuery("a".repeat(500))).toHaveLength(200);
    expect(normalizeQuery(null)).toBe("");
    expect(normalizeQuery(undefined)).toBe("");
  });
});

describe("resolveLimit", () => {
  it("usa SEARCH_PAGE_SIZE por defecto", () => {
    expect(resolveLimit(undefined)).toBe(SEARCH_PAGE_SIZE);
  });

  it("respeta límites válidos y descarta inválidos", () => {
    expect(resolveLimit(5)).toBe(5);
    expect(resolveLimit(0)).toBe(SEARCH_PAGE_SIZE);
    expect(resolveLimit(51)).toBe(SEARCH_PAGE_SIZE);
    expect(resolveLimit(-3)).toBe(SEARCH_PAGE_SIZE);
  });
});

describe("searchSortSchema", () => {
  it("valida relevance/recent y rechaza otros", () => {
    expect(searchSortSchema.parse("recent")).toBe("recent");
    expect(searchSortSchema.safeParse("desconocido").success).toBe(false);
  });
});

describe("searchLimitSchema", () => {
  it("acota a [1, 50]", () => {
    expect(searchLimitSchema.safeParse(50).success).toBe(true);
    expect(searchLimitSchema.safeParse(51).success).toBe(false);
    expect(searchLimitSchema.safeParse(0).success).toBe(false);
  });
});
