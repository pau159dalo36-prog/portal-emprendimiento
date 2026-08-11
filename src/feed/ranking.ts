// Ranking "Para ti" — espejo cliente (puro y determinista) de la fórmula SQL de
// `get_for_you_feed` en `20260814000000_fase4_4_feed.sql`. Sirve para
// explicabilidad interna, tests y debug: los componentes se pueden descomponer
// (recency/affinity/watch/completion/views/exploration/final) sin mostrarlos al
// usuario. La fuente de verdad de producción es la BD.
import {
  AFFINITY_AUTHOR_WEIGHT,
  AFFINITY_CAP,
  AFFINITY_ORGANIZATION_WEIGHT,
  AFFINITY_PROJECT_WEIGHT,
  AFFINITY_WEIGHT,
  COMPLETION_WEIGHT,
  EXPLORATION_LOG_SCALE,
  EXPLORATION_WEIGHT,
  RECENCY_HALF_LIFE_HOURS,
  RECENCY_WEIGHT,
  SCORE_DECIMALS,
  SMOOTHING_PRIOR_COMPLETION,
  SMOOTHING_PRIOR_PROGRESS,
  SMOOTHING_PRIOR_VIEWS,
  VIEW_CONFIDENCE_WEIGHT,
  VIEWS_LOG_SCALE,
  WATCH_PROGRESS_WEIGHT,
} from "@/feed/config";
import type { FeedScoreBreakdown } from "@/feed/types";

const MS_PER_HOUR = 3_600_000;

export type RankingInputs = {
  publishedAt: string;
  followsAuthor: boolean;
  followsProject: boolean;
  followsOrganization: boolean;
  qualifiedViews: number;
  averageProgress: number;
  completionRate: number;
  now?: Date;
};

// A) RECENCIA: half-life real 168 h (7 días) → 0.5^(age_hours/168).
//    0 views → compite igual por recencia.
export function recencyScore(publishedAt: string, now: Date = new Date()): number {
  const ageMs = Math.max(now.getTime() - new Date(publishedAt).getTime(), 0);
  const ageHours = ageMs / MS_PER_HOUR;
  return 0.5 ** (ageHours / RECENCY_HALF_LIFE_HOURS);
}

// B) AFINIDAD limitada (CAP): seguir ≠ aparecer primero.
export function affinityScore(input: {
  followsAuthor: boolean;
  followsProject: boolean;
  followsOrganization: boolean;
}): number {
  const raw =
    AFFINITY_AUTHOR_WEIGHT * (input.followsAuthor ? 1 : 0) +
    AFFINITY_PROJECT_WEIGHT * (input.followsProject ? 1 : 0) +
    AFFINITY_ORGANIZATION_WEIGHT * (input.followsOrganization ? 1 : 0);
  return Math.min(AFFINITY_CAP, raw);
}

// C/D) Smoothing bayesiano sencillo: n/(n+PRIOR_VIEWS)*observed + PRIOR/(n+PRIOR)*prior.
// Un vídeo con 1 vista al 100% no supera a uno con 100 vistas al 70%.
export function smoothedScore(
  observed: number,
  qualifiedViews: number,
  prior: number,
): number {
  const views = Math.max(qualifiedViews, 0);
  const confidence = views / (views + SMOOTHING_PRIOR_VIEWS);
  return confidence * observed + (1 - confidence) * prior;
}

export function watchScore(averageProgress: number, qualifiedViews: number): number {
  return smoothedScore(averageProgress, qualifiedViews, SMOOTHING_PRIOR_PROGRESS);
}

export function completionScore(completionRate: number, qualifiedViews: number): number {
  return smoothedScore(completionRate, qualifiedViews, SMOOTHING_PRIOR_COMPLETION);
}

// E) VIEWS como señal pequeña y capeada: min(1, log1p(n)/10).
export function viewsScore(qualifiedViews: number): number {
  const views = Math.max(qualifiedViews, 0);
  return Math.min(1, Math.log1p(views) / VIEWS_LOG_SCALE);
}

// F) EXPLORACIÓN: los posts nuevos con 0/pocas views compiten (sin
//    rich-get-richer). exp(-log1p(n)/20).
export function explorationScore(qualifiedViews: number): number {
  const views = Math.max(qualifiedViews, 0);
  return Math.exp(-Math.log1p(views) / EXPLORATION_LOG_SCALE);
}

export function finalScore(input: RankingInputs): number {
  const breakdown = scoreBreakdown(input);
  return breakdown.final;
}

export function scoreBreakdown(input: RankingInputs): FeedScoreBreakdown {
  const recency = recencyScore(input.publishedAt, input.now ?? new Date());
  const affinity = affinityScore({
    followsAuthor: input.followsAuthor,
    followsProject: input.followsProject,
    followsOrganization: input.followsOrganization,
  });
  const watch = watchScore(input.averageProgress, input.qualifiedViews);
  const completion = completionScore(input.completionRate, input.qualifiedViews);
  const views = viewsScore(input.qualifiedViews);
  const exploration = explorationScore(input.qualifiedViews);
  const final = roundScore(
    RECENCY_WEIGHT * recency +
      AFFINITY_WEIGHT * affinity +
      WATCH_PROGRESS_WEIGHT * watch +
      COMPLETION_WEIGHT * completion +
      VIEW_CONFIDENCE_WEIGHT * views +
      EXPLORATION_WEIGHT * exploration,
  );
  return { recency, affinity, watch, completion, views, exploration, final };
}

export function roundScore(value: number): number {
  const factor = 10 ** SCORE_DECIMALS;
  return Math.round(value * factor) / factor;
}
