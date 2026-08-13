// Carga inicial de la página Explorar (server side). Obtiene la PRIMERA página
// de cada pestaña (perfiles, proyectos, organizaciones, vídeos) en paralelo y
// la entrega a la UI como estado inicial. Las páginas siguientes y cualquier
// búsqueda posterior las pide el cliente con su propio cursor (ver ExploreApp).
//
// Privacidad: la garantiza la BD (RPCs SECURITY DEFINER). El score NO viaja a
// la UI (la capa de datos ya lo elimina).
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  searchOrganizations,
  searchProfiles,
  searchProjects,
  searchVideos,
} from "@/search/data";
import type { ExploreParams } from "@/search/schemas";
import type {
  SearchOrganization,
  SearchProfile,
  SearchProject,
  SearchPageResult,
  SearchVideo,
} from "@/search/types";
import type { Database } from "@/types/database.types";

export type ExploreInitialTab<T> =
  | { ok: true; items: T[]; nextCursor: string | null }
  | { ok: false; error: string };

export type ExploreInitialData = {
  profiles: ExploreInitialTab<SearchProfile>;
  projects: ExploreInitialTab<SearchProject>;
  organizations: ExploreInitialTab<SearchOrganization>;
  videos: ExploreInitialTab<SearchVideo>;
};

function toTab<T>(result: SearchPageResult<T>): ExploreInitialTab<T> {
  return result.ok
    ? { ok: true, items: result.page.items, nextCursor: result.page.nextCursor }
    : { ok: false, error: result.error };
}

export async function loadExploreHome(
  supabase: SupabaseClient<Database>,
  params: ExploreParams,
): Promise<ExploreInitialData> {
  const [profiles, projects, organizations, videos] = await Promise.all([
    searchProfiles(supabase, {
      query: params.q,
      sort: params.sort,
      role: params.role || null,
      language: params.language || null,
    }),
    searchProjects(supabase, {
      query: params.q,
      sort: params.sort,
      stage: params.stage || null,
      industry: params.industry || null,
    }),
    searchOrganizations(supabase, {
      query: params.q,
      sort: params.sort,
      industry: params.industry || null,
    }),
    searchVideos(supabase, {
      query: params.q,
      sort: params.sort,
      language: params.language || null,
    }),
  ]);

  return {
    profiles: toTab(profiles),
    projects: toTab(projects),
    organizations: toTab(organizations),
    videos: toTab(videos),
  };
}
