// Configuración de la búsqueda — espejo cliente de la fórmula y los límites
// definidos en la migración `20260815000000_fase5_search.sql`. La fuente de
// verdad es la BD (search_profiles / search_projects / search_organizations /
// search_videos); estas constantes alimentan la capa pura `src/search/ranking.ts`
// (explicabilidad interna y tests) y la paginación de la UI.

// Tamaño de página centralizado (la RPC lo acota a [1, 50]).
export const SEARCH_PAGE_SIZE = 12;
export const SEARCH_MAX_PAGE_SIZE = 50;

// La query se trunca a QUERY_MAX_LENGTH caracteres (normalizada) antes de
// llegar a la BD (la RPC aplica search_normalize sobre el valor recibido).
export const QUERY_MAX_LENGTH = 200;

// ---------------------------------------------------------------------------
// SCORE DE QUERY (search_normalize + fórmula relevance):
//   score = 0.60 * similarity(v_query, search_text)
//         + 0.25 * least(1, ts_rank(to_tsvector('simple'), plainto_tsquery(...)))
//         + 0.15 * search_recency(created_at)
//   score ∈ [0, 1], redondeado a 6 decimales (orden y cursor estables).
//   El componente textual (trigrama) domina; la recencia aporta como mucho 0.15.
// ---------------------------------------------------------------------------
export const SIMILARITY_WEIGHT = 0.6;
export const TS_RANK_WEIGHT = 0.25;
export const RECENCY_WEIGHT = 0.15;

// Browse (sin query): perfiles/proyectos/orgs → recencia pura; vídeos →
//   0.85 * recencia + 0.15 * least(1, ln(1+plays)/ln(101))
export const VIDEO_BROWSE_RECENCY_WEIGHT = 0.85;
export const VIDEO_BROWSE_ENGAGEMENT_WEIGHT = 0.15;
export const ENGAGEMENT_REFERENCE_PLAYS = 100;

// Recencia: decay exponencial de media-vida ~30 días → exp(-age/(30*86400)).
export const RECENCY_HALF_LIFE_SECONDS = 2_592_000; // 30 días
export const SCORE_DECIMALS = 6;

export const SEARCH_WEIGHTS_SUM =
  SIMILARITY_WEIGHT + TS_RANK_WEIGHT + RECENCY_WEIGHT;

// Valores válidos para p_sort (la RPC hace fallback a 'relevance' si llega un
// valor desconocido; este conjunto solo valida antes de enviar).
export const SEARCH_SORTS = ["relevance", "recent"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];
