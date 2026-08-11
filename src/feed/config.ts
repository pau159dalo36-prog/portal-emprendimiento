// Configuración del feed — Espejo cliente de la fórmula y los límites definidos
// en la migración `20260814000000_fase4_4_feed.sql`. La fuente de verdad del
// ranking es la BD (get_for_you_feed / get_following_feed); estas constantes
// alimentan la capa pura `src/feed/ranking.ts` (explicabilidad interna y tests)
// y la paginación de la UI.

// Tamaño de página centralizado (la RPC lo acota a [1, 50]).
export const FEED_PAGE_SIZE = 12;
export const FEED_MAX_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// A) RECENCIA — decay exponencial de media-vida (half-life) 168 h. Un post de
//    7 días vale 0.5, uno de 14 días 0.25, uno de 28 días ~0.0625. Nunca 0.
export const RECENCY_HALF_LIFE_HOURS = 168; // 7 días

// ---------------------------------------------------------------------------
// B) AFINIDAD — boost limitado (CAP) por follows de autor/proyecto/organización.
//    Seguir NO significa aparecer primero: el score final suma como mucho
//    AFFINITY_WEIGHT = 0.15.
// ---------------------------------------------------------------------------
export const AFFINITY_AUTHOR_WEIGHT = 0.6;
export const AFFINITY_PROJECT_WEIGHT = 0.4;
export const AFFINITY_ORGANIZATION_WEIGHT = 0.3;
export const AFFINITY_CAP = 1.0;

// ---------------------------------------------------------------------------
// C/D) CALIDAD DE VISIONADO + COMPLETION — smoothing bayesiano sencillo.
//      watch/observed = n/(n+PRIOR_VIEWS) * observed + PRIOR_VIEWS/(n+PRIOR_VIEWS) * prior
//      Un vídeo con 1 vista al 100% NO supera a uno con 100 vistas al 70%:
//      la confianza de la muestra pequeña (1/11) tira del resultado al prior.
// ---------------------------------------------------------------------------
export const SMOOTHING_PRIOR_VIEWS = 10;
export const SMOOTHING_PRIOR_PROGRESS = 0.5;
export const SMOOTHING_PRIOR_COMPLETION = 0.3;

// ---------------------------------------------------------------------------
// E) VIEWS — señal pequeña, capeada (log1p/10). Las vistas brutas NUNCA pueden
//    dominar el ranking: peso VIEW_CONFIDENCE_WEIGHT = 0.10 y capa logarítmica.
// ---------------------------------------------------------------------------
export const VIEWS_LOG_SCALE = 10;

// ---------------------------------------------------------------------------
// F) EXPLORACIÓN — los posts nuevos con 0/pocas views compiten. La saturación
//    logarítmica con los views evita el rich-get-richer.
// ---------------------------------------------------------------------------
export const EXPLORATION_LOG_SCALE = 20;

// ---------------------------------------------------------------------------
// FÓRMULA FINAL (pesos centralizados, suma = 1.0):
//   score = 0.35*recency + 0.15*affinity + 0.20*watch + 0.10*completion
//         + 0.10*views + 0.10*explore
//   score ∈ [0, 1], redondeado a 6 decimales (orden y cursor estables).
// ---------------------------------------------------------------------------
export const RECENCY_WEIGHT = 0.35;
export const AFFINITY_WEIGHT = 0.15;
export const WATCH_PROGRESS_WEIGHT = 0.2;
export const COMPLETION_WEIGHT = 0.1;
export const VIEW_CONFIDENCE_WEIGHT = 0.1;
export const EXPLORATION_WEIGHT = 0.1;
export const SCORE_DECIMALS = 6;

// ---------------------------------------------------------------------------
// DIVERSIDAD determinista (solo reordena DENTRO de cada página; no elimina
// candidatos y no afecta al cursor, que se deriva del orden SQL del lote).
// ---------------------------------------------------------------------------
export const DIVERSITY_MAX_CONSECUTIVE_AUTHOR = 2;
export const DIVERSITY_MAX_CONSECUTIVE_PROJECT = 3;
export const DIVERSITY_MAX_CONSECUTIVE_ORGANIZATION = 3;

// Válido si los pesos suman exactamente 1.0 (el score es una mezcla convexa).
export const FEED_WEIGHTS_SUM =
  RECENCY_WEIGHT +
  AFFINITY_WEIGHT +
  WATCH_PROGRESS_WEIGHT +
  COMPLETION_WEIGHT +
  VIEW_CONFIDENCE_WEIGHT +
  EXPLORATION_WEIGHT;
