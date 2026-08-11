import { describe, expect, it } from "vitest";

import {
  AFFINITY_CAP,
  FEED_WEIGHTS_SUM,
  RECENCY_HALF_LIFE_HOURS,
} from "@/feed/config";
import {
  affinityScore,
  completionScore,
  explorationScore,
  finalScore,
  recencyScore,
  roundScore,
  smoothedScore,
  viewsScore,
  watchScore,
} from "@/feed/ranking";
import type { RankingInputs } from "@/feed/ranking";

const NOW = new Date("2026-08-10T12:00:00.000Z");

function input(overrides: Partial<RankingInputs> = {}): RankingInputs {
  return {
    publishedAt: "2026-08-10T11:00:00.000Z", // hace 1 h
    followsAuthor: false,
    followsProject: false,
    followsOrganization: false,
    qualifiedViews: 0,
    averageProgress: 0,
    completionRate: 0,
    now: NOW,
    ...overrides,
  };
}

describe("recencia (decay gradual, nunca 0)", () => {
  it("un post nuevo tiene recency ~1", () => {
    expect(recencyScore("2026-08-10T11:59:59.000Z", NOW)).toBeCloseTo(1, 5);
  });

  it("el decay es gradual: 7 días ≈ 0.5, 14 días ≈ 0.25", () => {
    const sevenDays = recencyScore(new Date(NOW.getTime() - 7 * 24 * 3600_000).toISOString(), NOW);
    const fourteenDays = recencyScore(
      new Date(NOW.getTime() - 14 * 24 * 3600_000).toISOString(),
      NOW,
    );
    expect(sevenDays).toBeCloseTo(0.5, 2);
    expect(fourteenDays).toBeCloseTo(0.25, 2);
    expect(sevenDays).toBeGreaterThan(fourteenDays);
  });

  it("un post muy viejo nunca llega a 0 (decay exponencial)", () => {
    const old = recencyScore(new Date(NOW.getTime() - 90 * 24 * 3600_000).toISOString(), NOW);
    expect(old).toBeGreaterThan(0);
    expect(old).toBeLessThan(0.01);
    expect(RECENCY_HALF_LIFE_HOURS).toBe(168);
  });

  it("la recencia da ventaja: post reciente > post viejo (mismo resto)", () => {
    const fresh = finalScore(input({ publishedAt: "2026-08-10T11:00:00.000Z" }));
    const stale = finalScore(input({ publishedAt: "2026-07-01T11:00:00.000Z" }));
    expect(fresh).toBeGreaterThan(stale);
  });
});

describe("afinidad (boost limitado con CAP)", () => {
  it("sin follows la afinidad es 0", () => {
    expect(affinityScore({ followsAuthor: false, followsProject: false, followsOrganization: false })).toBe(0);
  });

  it("seguir al autor da boost pero no máx", () => {
    expect(affinityScore({ followsAuthor: true, followsProject: false, followsOrganization: false })).toBe(0.6);
  });

  it("el boost tiene CAP: autor+proyecto+org no supera 1.0", () => {
    const score = affinityScore({
      followsAuthor: true,
      followsProject: true,
      followsOrganization: true,
    });
    expect(score).toBe(Math.min(AFFINITY_CAP, 1.3));
    expect(score).toBeLessThanOrEqual(AFFINITY_CAP);
  });

  it("la afinidad aporta como mucho AFFINITY_WEIGHT (0.15) al score final", () => {
    const noAffinity = finalScore(input());
    const maxAffinity = finalScore(
      input({ followsAuthor: true, followsProject: true, followsOrganization: true }),
    );
    expect(maxAffinity - noAffinity).toBeLessThanOrEqual(0.16);
    expect(maxAffinity).toBeGreaterThan(noAffinity);
  });
});

describe("smoothing bayesiano con pocas muestras", () => {
  it("1 vista al 100% NO supera a 100 vistas al 70%", () => {
    const onePerfect = watchScore(1.0, 1);
    const manyGood = watchScore(0.7, 100);
    expect(onePerfect).toBeLessThan(manyGood);
    // Con la fórmula completa, la mejor retención de 100 vistas también gana.
    const onePerfectFull = finalScore(
      input({ qualifiedViews: 1, averageProgress: 1.0, completionRate: 1.0 }),
    );
    const manyGoodFull = finalScore(
      input({ qualifiedViews: 100, averageProgress: 0.7, completionRate: 0.3 }),
    );
    expect(onePerfectFull).toBeLessThan(manyGoodFull);
  });

  it("el smoothing tira al prior cuando no hay muestras (cold start)", () => {
    expect(watchScore(0, 0)).toBeCloseTo(0.5, 5);
    expect(completionScore(0, 0)).toBeCloseTo(0.3, 5);
  });

  it("smoothedScore con mezcla correcta", () => {
    // n=10: mitad observado, mitad prior.
    expect(smoothedScore(0.8, 10, 0.4)).toBeCloseTo(0.6, 5);
    // n→∞ tiende al valor observado.
    expect(smoothedScore(0.8, 100_000, 0.4)).toBeCloseTo(0.8, 3);
  });
});

describe("views capeadas (anti-manipulación)", () => {
  it("viewsScore es log1p/10 y queda capeada a 1.0", () => {
    expect(viewsScore(0)).toBe(0);
    expect(viewsScore(10)).toBeCloseTo(Math.log1p(10) / 10, 5);
    expect(viewsScore(1_000_000)).toBe(1);
  });

  it("explorationScore favorece los posts con pocas views", () => {
    expect(explorationScore(0)).toBe(1);
    expect(explorationScore(0)).toBeGreaterThan(explorationScore(1000));
  });

  it("las views brutas NO dominan: retención > volumen", () => {
    const highRetention = finalScore(
      input({ qualifiedViews: 100, averageProgress: 0.95, completionRate: 0.8 }),
    );
    const inflatedViews = finalScore(
      input({ qualifiedViews: 1_000_000, averageProgress: 0.1, completionRate: 0 }),
    );
    expect(highRetention).toBeGreaterThan(inflatedViews);
  });

  it("una inflación de views no puede mandar un post al top por sí sola", () => {
    const baseline = finalScore(input({ qualifiedViews: 0 }));
    const inflated = finalScore(input({ qualifiedViews: 10_000_000 }));
    // El peor caso: views aportan +0.10 y exploración cae ~0.055 → diferencia ≤ 0.17.
    expect(inflated - baseline).toBeLessThan(0.2);
  });
});

describe("cold start y exploración", () => {
  it("sin analytics el score sigue siendo > 0 y competitivo", () => {
    const cold = finalScore(input({ qualifiedViews: 0, averageProgress: 0, completionRate: 0 }));
    expect(cold).toBeGreaterThan(0.5);
  });

  it("un post nuevo con 0 views aparece (compite con el volumen)", () => {
    const freshZeroViews = finalScore(input({ qualifiedViews: 0 }));
    const weakButViewed = finalScore(
      input({ qualifiedViews: 1000, averageProgress: 0.05, completionRate: 0.01 }),
    );
    expect(freshZeroViews).toBeGreaterThan(weakButViewed);
  });
});

describe("consistencia de la fórmula", () => {
  it("los pesos suman 1.0 (mezcla convexa, score ∈ [0, 1])", () => {
    expect(FEED_WEIGHTS_SUM).toBeCloseTo(1.0, 10);
  });

  it("el score final se redondea a 6 decimales (cursor estable)", () => {
    expect(roundScore(0.123456789)).toBe(0.123457);
  });

  it("mayor retención mejora el ranking y mayor completion también", () => {
    const betterRetention = finalScore(
      input({ qualifiedViews: 50, averageProgress: 0.9, completionRate: 0.3 }),
    );
    const worseRetention = finalScore(
      input({ qualifiedViews: 50, averageProgress: 0.4, completionRate: 0.3 }),
    );
    const betterCompletion = finalScore(
      input({ qualifiedViews: 50, averageProgress: 0.6, completionRate: 0.9 }),
    );
    const worseCompletion = finalScore(
      input({ qualifiedViews: 50, averageProgress: 0.6, completionRate: 0.1 }),
    );
    expect(betterRetention).toBeGreaterThan(worseRetention);
    expect(betterCompletion).toBeGreaterThan(worseCompletion);
  });
});
