// Ranking de búsqueda — espejo cliente (puro y determinista) de la fórmula SQL
// de `20260815000000_fase5_search.sql` (search_normalize + scoring relevance/
// browse de cada RPC). Sirve para explicabilidad interna, tests y debug. La
// fuente de verdad de producción es la BD.
import {
  ENGAGEMENT_REFERENCE_PLAYS,
  RECENCY_HALF_LIFE_SECONDS,
  RECENCY_WEIGHT,
  SCORE_DECIMALS,
  SIMILARITY_WEIGHT,
  TS_RANK_WEIGHT,
  VIDEO_BROWSE_ENGAGEMENT_WEIGHT,
  VIDEO_BROWSE_RECENCY_WEIGHT,
} from "@/search/config";

// Normalización ESQUINA CON ESQUINA con public.search_normalize de la
// migración: minúsculas + sin acentos + sin puntuación + espacios colapsados.
// Solo ASCII: cubre la práctica totalidad de texto en el portal sin necesidad
// de la extensión `unaccent` en el cliente (que en la BD sí está instalada y es
// la fuente de verdad).
const ACCENTS: Record<string, string> = {
  á: "a", à: "a", ä: "a", â: "a", ã: "a", å: "a",
  é: "e", è: "e", ë: "e", ê: "e",
  í: "i", ì: "i", ï: "i", î: "i",
  ó: "o", ò: "o", ö: "o", ô: "o", õ: "o",
  ú: "u", ù: "u", ü: "u", û: "u",
  ñ: "n", ç: "c",
};

export function stripAccents(input: string): string {
  return input
    .split("")
    .map((ch) => ACCENTS[ch.toLowerCase()] ?? ch)
    .join("");
}

// Espejo de `search_normalize`: lower + sin acentos + sin puntuación
// (equivalente a regexp_replace(..., '[^a-z0-9]+', ' ', 'g')) + colapsar.
export function normalizeSearch(input: string | null | undefined): string {
  const source = input ?? "";
  const lower = stripAccents(source).toLowerCase();
  return lower.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function roundScore(value: number): number {
  const factor = 10 ** SCORE_DECIMALS;
  return Math.round(value * factor) / factor;
}

// Recencia: espejo de `search_recency` (decay exponencial de media-vida 30 días:
// exp(-age/(30*86400))). 0 días → 1.0, 30 días → ~0.5, 60 días → ~0.25.
export function recencyScore(createdAt: string, now: Date = new Date()): number {
  const ageSeconds = Math.max((now.getTime() - new Date(createdAt).getTime()) / 1000, 0);
  return roundScore(Math.exp(-ageSeconds / RECENCY_HALF_LIFE_SECONDS));
}

// Aproximación trigrama de pg_trgm.similarity (solo para explicabilidad/tests;
// la BD es la fuente de verdad). Extrae los trigramas 'simple' de una cadena
// normalizada y calcula la similaridad de Jaccard con padding '  x  '.
export function trigramSimilarity(a: string, b: string): number {
  const trigramsA = extractTrigrams(a);
  const trigramsB = extractTrigrams(b);
  if (trigramsA.length === 0 && trigramsB.length === 0) {
    return 1;
  }
  const setA = new Set(trigramsA);
  const setB = new Set(trigramsB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) {
      intersection += 1;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function extractTrigrams(input: string): string[] {
  const padded = `  ${input}  `;
  const result: string[] = [];
  for (let i = 0; i <= padded.length - 3; i += 1) {
    result.push(padded.slice(i, i + 3));
  }
  return result;
}

export type CombinedScoreInput = {
  // Texto completo equivalente a search_text (todos los campos concatenados).
  text: string | null | undefined;
  query: string;
  createdAt: string;
  now?: Date;
};

// Espejo del scoring de QUERY de las RPC:
//   0.60 * similarity + 0.25 * least(1, ts_rank) + 0.15 * recency, redondeado a
//   6 decimales. `ts_rank` no se replica aquí (es FTS 'simple' de PostgreSQL):
//   se aproxima como 0 (el resto de señales ya cubren el ranking determinista);
//   `similarity` se aproxima con trigramSimilarity sobre search_text.
export function combinedScore(input: CombinedScoreInput): number {
  const text = normalizeSearch(input.text);
  const query = normalizeSearch(input.query);
  const similarity = text === "" || query === "" ? 0 : trigramSimilarity(text, query);
  const recency = recencyScore(input.createdAt, input.now ?? new Date());
  return roundScore(
    SIMILARITY_WEIGHT * similarity +
      TS_RANK_WEIGHT * 0 +
      RECENCY_WEIGHT * recency,
  );
}

export type VideoBrowseScoreInput = {
  createdAt: string;
  plays: number;
  now?: Date;
};

// Espejo del browse de vídeos (sin query):
//   0.85 * recencia + 0.15 * least(1, ln(1+plays)/ln(101)).
export function videoBrowseScore(input: VideoBrowseScoreInput): number {
  const recency = recencyScore(input.createdAt, input.now ?? new Date());
  const engagement = Math.min(
    1,
    Math.log(1 + Math.max(0, input.plays)) / Math.log(1 + ENGAGEMENT_REFERENCE_PLAYS),
  );
  return roundScore(
    VIDEO_BROWSE_RECENCY_WEIGHT * recency +
      VIDEO_BROWSE_ENGAGEMENT_WEIGHT * engagement,
  );
}
