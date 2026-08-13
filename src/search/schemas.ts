// Esquemas y serialización de la búsqueda. El cursor es OPACO para la UI: la
// capa de datos lo serializa a una cadena y la UI lo guarda/reenvía sin
// interpretarlo. Formato: { score, createdAt, id } (search_score DESC,
// created_at DESC, id DESC), igual para las cuatro entidades.
import { z } from "zod";

import { INDUSTRIES } from "@/organizations/constants";
import { USER_TYPES } from "@/profiles/constants";
import { PROJECT_STAGES } from "@/projects/constants";
import { SEARCH_MAX_PAGE_SIZE, SEARCH_PAGE_SIZE, SEARCH_SORTS } from "@/search/config";

export { INDUSTRIES, PROJECT_STAGES, USER_TYPES };

export const searchCursorSchema = z.object({
  score: z.number(),
  createdAt: z.string(),
  id: z.string(),
});

export type SearchCursorData = z.infer<typeof searchCursorSchema>;

// El límite lo acota además la BD (greatest(least(p_limit, 50), 1)).
export const searchLimitSchema = z.number().int().min(1).max(SEARCH_MAX_PAGE_SIZE).optional();

export const searchSortSchema = z.enum(SEARCH_SORTS).default("relevance");

// Idiomas ofrecidos en el filtro (profile_languages.code / videos.
// original_language permiten cualquier código ISO 639-1; el portal ofrece los
// más relevantes para su audiencia).
export const LANGUAGES = ["es", "en", "fr", "pt", "de", "it"] as const;

const CURSOR_VERSION = 1;

type SerializedCursor = {
  v: number;
  s: number;
  t: string;
  i: string;
};

export function serializeCursor(cursor: SearchCursorData): string {
  const payload: SerializedCursor = {
    v: CURSOR_VERSION,
    s: cursor.score,
    t: cursor.createdAt,
    i: cursor.id,
  };
  return encodeURIComponent(JSON.stringify(payload));
}

export function parseCursor(raw: string | null | undefined): SearchCursorData | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SerializedCursor;
    if (parsed?.v !== CURSOR_VERSION || typeof parsed.s !== "number") {
      return null;
    }
    const result = searchCursorSchema.safeParse({
      score: parsed.s,
      createdAt: parsed.t,
      id: parsed.i,
    });
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// Normaliza la query: trunca a QUERY_MAX_LENGTH caracteres y elimina espacio
// redundante (la BD aplica su propia normalización con search_path='').
export function normalizeQuery(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  return trimmed.slice(0, 200);
}

// ---------------------------------------------------------------------------
// Parámetros de la página /explorar (?q=&tab=&sort=&role=&language=&stage=
// &industry=). Validados con Zod y con fallback seguro: un valor inválido o
// ausente NUNCA lanza — siempre se cae a un valor por defecto (la página nunca
// devuelve 500 por un query string raro).
// ---------------------------------------------------------------------------
export const EXPLORE_TABS = ["all", "videos", "projects", "organizations", "profiles"] as const;
export type ExploreTab = (typeof EXPLORE_TABS)[number];

// searchParams de Next viene como string | string[] | undefined.
function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

export const exploreParamsSchema = z.object({
  q: z.preprocess((v) => normalizeQuery(firstString(v)), z.string()).catch(""),
  tab: z.preprocess((v) => firstString(v), z.enum(EXPLORE_TABS)).catch("all"),
  sort: z.preprocess((v) => firstString(v), z.enum(SEARCH_SORTS)).catch("relevance"),
  role: z.preprocess((v) => firstString(v), z.string()).catch(""),
  language: z.preprocess((v) => firstString(v), z.string()).catch(""),
  stage: z.preprocess((v) => firstString(v), z.string()).catch(""),
  industry: z.preprocess((v) => firstString(v), z.string()).catch(""),
});

export type ExploreParams = z.infer<typeof exploreParamsSchema>;

// Serializa params → query string, omitiendo valores vacíos o por defecto
// (URL canónica y compartible). null cuando no hay ningún parámetro.
export function buildExploreQuery(params: ExploreParams): Record<string, string> | null {
  const query: Record<string, string> = {};
  if (params.q) query.q = params.q;
  if (params.tab !== "all") query.tab = params.tab;
  if (params.sort !== "relevance") query.sort = params.sort;
  if (params.role) query.role = params.role;
  if (params.language) query.language = params.language;
  if (params.stage) query.stage = params.stage;
  if (params.industry) query.industry = params.industry;
  return Object.keys(query).length > 0 ? query : null;
}

export function resolveLimit(limit: number | undefined): number {
  const parsed = searchLimitSchema.safeParse(limit ?? SEARCH_PAGE_SIZE);
  return parsed.success ? (parsed.data ?? SEARCH_PAGE_SIZE) : SEARCH_PAGE_SIZE;
}
