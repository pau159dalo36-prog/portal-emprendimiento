// Data layer de la búsqueda. Cuatro funciones especializadas (una por entidad)
// que llaman a las RPCs SECURITY DEFINER de `20260815000000_fase5_search.sql`:
//
//   searchProfiles / searchProjects / searchOrganizations / searchVideos
//
// Cada item llega con TODO lo necesario para renderizar en UN resultado de RPC
// (sin N+1). La query se normaliza y trunca aquí (espejo de la BD) y el cursor
// de la siguiente página se deriva del ÚLTIMO item del lote SQL: paginación
// estable y sin duplicados. La BD garantiza la privacidad (perfiles privados,
// vídeos no distribuibles, bloqueos simétricos); esta capa NO la implementa.
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeQuery,
  parseCursor,
  resolveLimit,
  searchSortSchema,
  serializeCursor,
} from "@/search/schemas";
import type {
  SearchOrganization,
  SearchOrganizationResult,
  SearchPageResult,
  SearchProfile,
  SearchProfileResult,
  SearchProject,
  SearchProjectResult,
  SearchVideo,
  SearchVideoResult,
} from "@/search/types";
import type { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Functions"]["search_profiles"]["Returns"][number];
type ProjectRow = Database["public"]["Functions"]["search_projects"]["Returns"][number];
type OrganizationRow = Database["public"]["Functions"]["search_organizations"]["Returns"][number];
type VideoRow = Database["public"]["Functions"]["search_videos"]["Returns"][number];

// PostgREST genera `returns table` con TODAS las columnas non-null, pero en
// runtime las columnas que provienen de LEFT JOIN (owner, project,
// organization) o de columnas nullable del esquema pueden devolver NULL. Estos
// son los tipos REALES de fila: se aplican en la frontera de la RPC (cast).
type NullableProfileKeys = "avatar_url" | "bio" | "headline" | "location";
type NullableProjectKeys =
  | "tagline"
  | "description"
  | "cover_image_url"
  | "owner_full_name"
  | "owner_username"
  | "owner_avatar_url"
  | "organization_id"
  | "organization_name"
  | "organization_slug";
type NullableOrganizationKeys =
  | "headline"
  | "description"
  | "logo_url"
  | "location"
  | "owner_full_name"
  | "owner_username"
  | "owner_avatar_url";
type NullableVideoKeys =
  | "caption"
  | "poster_path"
  | "poster_bucket"
  | "owner_full_name"
  | "owner_username"
  | "owner_avatar_url"
  | "project_id"
  | "project_name"
  | "project_slug"
  | "organization_id"
  | "organization_name"
  | "organization_slug";
type NullableVideoNumberKeys = "duration_seconds" | "width" | "height";

export type SearchProfileRow = Omit<ProfileRow, NullableProfileKeys> &
  { [K in NullableProfileKeys]: string | null };
export type SearchProjectRow = Omit<ProjectRow, NullableProjectKeys> &
  { [K in NullableProjectKeys]: string | null };
export type SearchOrganizationRow = Omit<OrganizationRow, NullableOrganizationKeys> &
  { [K in NullableOrganizationKeys]: string | null };
export type SearchVideoRow = Omit<VideoRow, NullableVideoKeys | NullableVideoNumberKeys> &
  { [K in NullableVideoKeys]: string | null } &
  { [K in NullableVideoNumberKeys]: number | null };

export type CommonSearchParams = {
  query?: string;
  limit?: number;
  cursor?: string | null;
  sort?: string;
};

export type ProfileSearchParams = CommonSearchParams & { role?: string | null; language?: string | null };
export type ProjectSearchParams = CommonSearchParams & { stage?: string | null; industry?: string | null };
export type OrganizationSearchParams = CommonSearchParams & { industry?: string | null };
export type VideoSearchParams = CommonSearchParams & { language?: string | null };

function toProfile(row: SearchProfileRow): SearchProfileResult {
  return {
    id: row.profile_id,
    fullName: row.full_name,
    username: row.username,
    headline: row.headline,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    location: row.location,
    userTypes: row.user_types,
    isFollowing: row.is_following,
    score: row.search_score,
    createdAt: row.created_at,
  };
}

function toProject(row: SearchProjectRow): SearchProjectResult {
  return {
    id: row.project_id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    slug: row.slug,
    coverImageUrl: row.cover_image_url,
    stage: row.stage,
    industries: row.industries,
    ownerId: row.owner_id,
    ownerFullName: row.owner_full_name,
    ownerUsername: row.owner_username,
    ownerAvatarUrl: row.owner_avatar_url,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    score: row.search_score,
    createdAt: row.created_at,
  };
}

function toOrganization(row: SearchOrganizationRow): SearchOrganizationResult {
  return {
    id: row.organization_id,
    name: row.name,
    headline: row.headline,
    description: row.description,
    slug: row.slug,
    logoUrl: row.logo_url,
    location: row.location,
    industries: row.industries,
    ownerId: row.owner_id,
    ownerFullName: row.owner_full_name,
    ownerUsername: row.owner_username,
    ownerAvatarUrl: row.owner_avatar_url,
    score: row.search_score,
    createdAt: row.created_at,
  };
}

function toVideo(row: SearchVideoRow): SearchVideoResult {
  return {
    id: row.video_id,
    title: row.title,
    caption: row.caption,
    thumbnailPath: row.thumbnail_path,
    thumbnailBucket: row.thumbnail_bucket,
    posterPath: row.poster_path,
    posterBucket: row.poster_bucket,
    durationSeconds: row.duration_seconds,
    width: row.width,
    height: row.height,
    ownerId: row.owner_id,
    ownerFullName: row.owner_full_name,
    ownerUsername: row.owner_username,
    ownerAvatarUrl: row.owner_avatar_url,
    projectId: row.project_id,
    projectName: row.project_name,
    projectSlug: row.project_slug,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    score: row.search_score,
    createdAt: row.created_at,
  };
}

export function toProfileView(result: SearchProfileResult): SearchProfile {
  return {
    id: result.id,
    fullName: result.fullName,
    username: result.username,
    headline: result.headline,
    bio: result.bio,
    avatarUrl: result.avatarUrl,
    location: result.location,
    userTypes: result.userTypes,
    isFollowing: result.isFollowing,
    createdAt: result.createdAt,
  };
}

export function toProjectView(result: SearchProjectResult): SearchProject {
  return {
    id: result.id,
    name: result.name,
    tagline: result.tagline,
    description: result.description,
    slug: result.slug,
    coverImageUrl: result.coverImageUrl,
    stage: result.stage,
    industries: result.industries,
    owner: {
      id: result.ownerId,
      fullName: result.ownerFullName,
      username: result.ownerUsername,
      avatarUrl: result.ownerAvatarUrl,
    },
    organization:
      result.organizationId && result.organizationName
        ? {
            id: result.organizationId,
            name: result.organizationName,
            slug: result.organizationSlug ?? "",
          }
        : null,
    createdAt: result.createdAt,
  };
}

export function toOrganizationView(result: SearchOrganizationResult): SearchOrganization {
  return {
    id: result.id,
    name: result.name,
    headline: result.headline,
    description: result.description,
    slug: result.slug,
    logoUrl: result.logoUrl,
    location: result.location,
    industries: result.industries,
    owner: {
      id: result.ownerId,
      fullName: result.ownerFullName,
      username: result.ownerUsername,
      avatarUrl: result.ownerAvatarUrl,
    },
    createdAt: result.createdAt,
  };
}

export function toVideoView(result: SearchVideoResult): SearchVideo {
  return {
    id: result.id,
    title: result.title,
    caption: result.caption,
    thumbnailPath: result.thumbnailPath,
    thumbnailBucket: result.thumbnailBucket,
    posterPath: result.posterPath,
    posterBucket: result.posterBucket,
    durationSeconds: result.durationSeconds,
    width: result.width,
    height: result.height,
    owner: {
      id: result.ownerId,
      fullName: result.ownerFullName,
      username: result.ownerUsername,
      avatarUrl: result.ownerAvatarUrl,
    },
    project:
      result.projectId && result.projectName
        ? {
            id: result.projectId,
            name: result.projectName,
            slug: result.projectSlug ?? "",
          }
        : null,
    organization:
      result.organizationId && result.organizationName
        ? {
            id: result.organizationId,
            name: result.organizationName,
            slug: result.organizationSlug ?? "",
          }
        : null,
    createdAt: result.createdAt,
  };
}

function serializeNext(score: number, createdAt: string, id: string): string {
  return serializeCursor({ score, createdAt, id });
}

function resolveSort(sort: string | undefined): string {
  const parsed = searchSortSchema.safeParse(sort);
  return parsed.success ? parsed.data : "relevance";
}

export async function searchProfiles(
  supabase: SupabaseClient<Database>,
  params: ProfileSearchParams = {},
): Promise<SearchPageResult<SearchProfile>> {
  const query = normalizeQuery(params.query);
  const limit = resolveLimit(params.limit);
  const cursor = parseCursor(params.cursor);

  const { data, error } = await supabase.rpc("search_profiles", {
    p_query: query,
    p_limit: limit,
    p_cursor_score: cursor?.score,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_role: params.role ?? undefined,
    p_language: params.language ?? undefined,
    p_sort: resolveSort(params.sort),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as SearchProfileRow[];
  if (rows.length === 0) {
    return { ok: true, page: { items: [], nextCursor: null } };
  }

  const last = rows[rows.length - 1];
  const items = rows.map((row) => toProfileView(toProfile(row)));
  return {
    ok: true,
    page: {
      items,
      nextCursor: serializeNext(last.search_score, last.created_at, last.profile_id),
    },
  };
}

export async function searchProjects(
  supabase: SupabaseClient<Database>,
  params: ProjectSearchParams = {},
): Promise<SearchPageResult<SearchProject>> {
  const query = normalizeQuery(params.query);
  const limit = resolveLimit(params.limit);
  const cursor = parseCursor(params.cursor);

  const { data, error } = await supabase.rpc("search_projects", {
    p_query: query,
    p_limit: limit,
    p_cursor_score: cursor?.score,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_stage: params.stage ?? undefined,
    p_industry: params.industry ?? undefined,
    p_sort: resolveSort(params.sort),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as SearchProjectRow[];
  if (rows.length === 0) {
    return { ok: true, page: { items: [], nextCursor: null } };
  }

  const last = rows[rows.length - 1];
  const items = rows.map((row) => toProjectView(toProject(row)));
  return {
    ok: true,
    page: {
      items,
      nextCursor: serializeNext(last.search_score, last.created_at, last.project_id),
    },
  };
}

export async function searchOrganizations(
  supabase: SupabaseClient<Database>,
  params: OrganizationSearchParams = {},
): Promise<SearchPageResult<SearchOrganization>> {
  const query = normalizeQuery(params.query);
  const limit = resolveLimit(params.limit);
  const cursor = parseCursor(params.cursor);

  const { data, error } = await supabase.rpc("search_organizations", {
    p_query: query,
    p_limit: limit,
    p_cursor_score: cursor?.score,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_industry: params.industry ?? undefined,
    p_sort: resolveSort(params.sort),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as SearchOrganizationRow[];
  if (rows.length === 0) {
    return { ok: true, page: { items: [], nextCursor: null } };
  }

  const last = rows[rows.length - 1];
  const items = rows.map((row) => toOrganizationView(toOrganization(row)));
  return {
    ok: true,
    page: {
      items,
      nextCursor: serializeNext(last.search_score, last.created_at, last.organization_id),
    },
  };
}

export async function searchVideos(
  supabase: SupabaseClient<Database>,
  params: VideoSearchParams = {},
): Promise<SearchPageResult<SearchVideo>> {
  const query = normalizeQuery(params.query);
  const limit = resolveLimit(params.limit);
  const cursor = parseCursor(params.cursor);

  const { data, error } = await supabase.rpc("search_videos", {
    p_query: query,
    p_limit: limit,
    p_cursor_score: cursor?.score,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_language: params.language ?? undefined,
    p_sort: resolveSort(params.sort),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as SearchVideoRow[];
  if (rows.length === 0) {
    return { ok: true, page: { items: [], nextCursor: null } };
  }

  const last = rows[rows.length - 1];
  const items = rows.map((row) => toVideoView(toVideo(row)));
  return {
    ok: true,
    page: {
      items,
      nextCursor: serializeNext(last.search_score, last.created_at, last.video_id),
    },
  };
}
