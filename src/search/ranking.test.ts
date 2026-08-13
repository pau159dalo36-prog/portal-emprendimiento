import { describe, expect, it } from "vitest";

import {
  combinedScore,
  normalizeSearch,
  recencyScore,
  roundScore,
  stripAccents,
  trigramSimilarity,
  videoBrowseScore,
} from "@/search/ranking";

describe("normalizeSearch (espejo de public.search_normalize)", () => {
  it("minúsculas", () => {
    expect(normalizeSearch("MECÁNICA")).toBe("mecanica");
  });

  it("sin acentos", () => {
    expect(normalizeSearch("Inteligencia Ángeles")).toBe("inteligencia angeles");
  });

  it("elimina puntuación y colapsa espacios", () => {
    expect(normalizeSearch("  Ana, García... ¡Hola!")).toBe("ana garcia hola");
  });

  it("trata null y undefined como cadena vacía", () => {
    expect(normalizeSearch(null)).toBe("");
    expect(normalizeSearch(undefined)).toBe("");
  });
});

describe("stripAccents", () => {
  it("cubre el repertorio hispano", () => {
    expect(stripAccents("áéíóúüñç")).toBe("aeiouunc");
  });
});

describe("trigramSimilarity", () => {
  it("coincidencia exacta es 1", () => {
    expect(trigramSimilarity("mecanica", "mecanica")).toBe(1);
  });

  it("es simétrica y entre 0 y 1", () => {
    const a = trigramSimilarity("mecanica", "mecanico");
    const b = trigramSimilarity("mecanico", "mecanica");
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    expect(a).toBe(b);
  });

  it("cadenas sin relación dan ~0", () => {
    expect(trigramSimilarity("xyzabc", "sistemas")).toBeLessThan(0.2);
  });
});

describe("recencyScore (espejo de public.search_recency, media-vida 30 días)", () => {
  it("recién creado ≈ 1", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    expect(recencyScore("2026-08-15T00:00:00.000Z", now)).toBeCloseTo(1, 6);
  });

  it("30 días ≈ exp(-1) ≈ 0.368", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    expect(recencyScore("2026-07-16T00:00:00.000Z", now)).toBeCloseTo(Math.exp(-1), 3);
  });

  it("nunca negativo y decae", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    const fresh = recencyScore("2026-08-15T00:00:00.000Z", now);
    const old = recencyScore("2026-05-07T00:00:00.000Z", now); // 100 días
    expect(fresh).toBeGreaterThan(old);
    expect(old).toBeGreaterThan(0);
  });
});

describe("combinedScore (espejo del scoring de query de las RPC)", () => {
  it("redondea a 6 decimales y acota a [0,1]", () => {
    const score = combinedScore({
      text: "Motor eléctrico proyecto",
      query: "motor",
      createdAt: "2026-08-15T00:00:00.000Z",
      now: new Date("2026-08-15T00:00:00.000Z"),
    });
    expect(Number.isInteger(score * 1_000_000)).toBe(true);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("la coincidencia textual domina: relevancia > mera recencia", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    const matched = combinedScore({
      text: "Motor eléctrico",
      query: "motor",
      createdAt: "2025-01-01T00:00:00.000Z",
      now,
    });
    const recentOnly = combinedScore({
      text: "Sin relación",
      query: "motor",
      createdAt: "2026-08-15T00:00:00.000Z",
      now,
    });
    expect(matched).toBeGreaterThan(recentOnly);
  });

  it("recencia acota como mucho 0.15 (sin coincidencia textual)", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    const score = combinedScore({
      text: "Sin relación",
      query: "motor",
      createdAt: "2026-08-15T00:00:00.000Z",
      now,
    });
    expect(score).toBeLessThanOrEqual(0.15);
  });

  it("roundScore", () => {
    expect(roundScore(0.123456789)).toBe(0.123457);
  });
});

describe("videoBrowseScore (espejo del browse de vídeos sin query)", () => {
  it("0.85*recencia + 0.15*engagement, acotado a [0,1]", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    const fresh = videoBrowseScore({
      createdAt: "2026-08-15T00:00:00.000Z",
      plays: 100,
      now,
    });
    const oldNoPlays = videoBrowseScore({
      createdAt: "2026-05-07T00:00:00.000Z", // 100 días
      plays: 0,
      now,
    });
    expect(fresh).toBeGreaterThan(oldNoPlays);
    expect(fresh).toBeLessThanOrEqual(1);
    expect(oldNoPlays).toBeGreaterThan(0);
  });

  it("engagement se satura en 1 a partir de ln(101) plays", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    const saturated = videoBrowseScore({
      createdAt: "2026-08-15T00:00:00.000Z",
      plays: 1000,
      now,
    });
    const atReference = videoBrowseScore({
      createdAt: "2026-08-15T00:00:00.000Z",
      plays: 100,
      now,
    });
    expect(saturated).toBeCloseTo(1, 6);
    expect(atReference).toBeCloseTo(1, 6);
  });
});
