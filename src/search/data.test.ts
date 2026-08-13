import { describe, expect, it } from "vitest";

import { SEARCH_PAGE_SIZE } from "@/search/config";
import {
  searchOrganizations,
  searchProfiles,
  searchProjects,
  searchVideos,
} from "@/search/data";
import type {
  SearchOrganizationRow,
  SearchProfileRow,
  SearchProjectRow,
  SearchVideoRow,
} from "@/search/data";
import { parseCursor, serializeCursor } from "@/search/schemas";

function profileRow(overrides: Partial<SearchProfileRow> = {}): SearchProfileRow {
  return {
    profile_id: "profile-1",
    full_name: "Carlos Mecánica",
    username: "carlos_mec",
    headline: "Ingeniero mecánico",
    bio: null,
    avatar_url: null,
    location: "Madrid",
    user_types: ["emprendedor"],
    is_following: false,
    search_score: 0.85,
    created_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function projectRow(overrides: Partial<SearchProjectRow> = {}): SearchProjectRow {
  return {
    project_id: "project-1",
    name: "Proyecto Motor",
    tagline: "Motor eléctrico eficiente",
    description: null,
    slug: "proyecto-motor",
    cover_image_url: null,
    stage: "prototipo",
    industries: ["tecnologia", "energia"],
    owner_id: "owner-1",
    owner_full_name: "Carlos Mecánica",
    owner_username: "carlos_mec",
    owner_avatar_url: null,
    organization_id: null,
    organization_name: null,
    organization_slug: null,
    search_score: 0.85,
    created_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function organizationRow(overrides: Partial<SearchOrganizationRow> = {}): SearchOrganizationRow {
  return {
    organization_id: "org-1",
    name: "Org Mecánica",
    headline: "Taller industrial",
    description: null,
    slug: "org-mecanica",
    logo_url: null,
    location: null,
    industries: ["energia"],
    owner_id: "owner-1",
    owner_full_name: "Carlos Mecánica",
    owner_username: "carlos_mec",
    owner_avatar_url: null,
    search_score: 0.85,
    created_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function videoRow(overrides: Partial<SearchVideoRow> = {}): SearchVideoRow {
  return {
    video_id: "video-1",
    title: "Motor eléctrico paso a paso",
    caption: null,
    thumbnail_path: "thumb/video-1.jpg",
    thumbnail_bucket: "videos",
    poster_path: null,
    poster_bucket: null,
    duration_seconds: 120,
    width: 1920,
    height: 1080,
    owner_id: "owner-1",
    owner_full_name: "Carlos Mecánica",
    owner_username: "carlos_mec",
    owner_avatar_url: null,
    project_id: null,
    project_name: null,
    project_slug: null,
    organization_id: null,
    organization_name: null,
    organization_slug: null,
    search_score: 0.85,
    created_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function createSupabaseSpy(options: {
  rpcResult?: { data?: unknown[]; error?: { message: string } };
} = {}) {
  const calls: { rpc: string; args: Record<string, unknown> }[] = [];

  function rpc(name: string, args: Record<string, unknown>) {
    calls.push({ rpc: name, args });
    const result = options.rpcResult ?? { data: [] as unknown[] };
    return {
      then(onFulfilled: (value: unknown) => unknown) {
        if (result.error) {
          return Promise.resolve(onFulfilled({ data: null, error: result.error }));
        }
        return Promise.resolve(onFulfilled({ data: result.data ?? [], error: null }));
      },
    };
  }

  return { client: { rpc } as unknown as Parameters<typeof searchProfiles>[0], calls };
}

describe("searchProfiles", () => {
  it("llama a la RPC con query normalizada, límite por defecto y sin cursor", async () => {
    const { client, calls } = createSupabaseSpy({ rpcResult: { data: [profileRow()] } });
    const result = await searchProfiles(client, { query: "  Mecánica  " });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].rpc).toBe("search_profiles");
    expect(calls[0].args.p_query).toBe("Mecánica");
    expect(calls[0].args.p_limit).toBe(SEARCH_PAGE_SIZE);
    expect(calls[0].args.p_cursor_score).toBeUndefined();
  });

  it("mapea la fila y deriva el cursor del último item", async () => {
    const { client } = createSupabaseSpy({
      rpcResult: { data: [profileRow({ profile_id: "p1" }), profileRow({ profile_id: "p2" })] },
    });
    const result = await searchProfiles(client, { query: "mecanica" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items).toHaveLength(2);
    expect(result.page.items[0].id).toBe("p1");
    expect(result.page.items[0].isFollowing).toBe(false);
    expect(parseCursor(result.page.nextCursor)).toEqual({
      score: 0.85,
      createdAt: "2026-08-01T10:00:00.000Z",
      id: "p2",
    });
  });

  it("envía el cursor y los filtros cuando existen", async () => {
    const cursor = serializeCursor({ score: 0.8, createdAt: "2026-08-01T09:00:00.000Z", id: "p9" });
    const { client, calls } = createSupabaseSpy({ rpcResult: { data: [profileRow()] } });
    await searchProfiles(client, {
      query: "ia",
      limit: 5,
      cursor,
      sort: "recent",
      role: "inversor",
      language: "en",
    });

    expect(calls[0].args.p_limit).toBe(5);
    expect(calls[0].args.p_cursor_score).toBe(0.8);
    expect(calls[0].args.p_cursor_created_at).toBe("2026-08-01T09:00:00.000Z");
    expect(calls[0].args.p_cursor_id).toBe("p9");
    expect(calls[0].args.p_sort).toBe("recent");
    expect(calls[0].args.p_role).toBe("inversor");
    expect(calls[0].args.p_language).toBe("en");
  });

  it("página vacía → nextCursor null (sin duplicados al agotar)", async () => {
    const { client } = createSupabaseSpy({ rpcResult: { data: [] } });
    const result = await searchProfiles(client, { query: "nada" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items).toHaveLength(0);
    expect(result.page.nextCursor).toBeNull();
  });

  it("propaga el error de la RPC", async () => {
    const { client } = createSupabaseSpy({
      rpcResult: { error: { message: "boom" } },
    });
    const result = await searchProfiles(client, { query: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("boom");
  });
});

describe("searchProjects", () => {
  it("envía stage/industry y mapea owner + organización (nullable)", async () => {
    const { client, calls } = createSupabaseSpy({
      rpcResult: {
        data: [
          projectRow({
            organization_id: "org-1",
            organization_name: "Org Mecánica",
            organization_slug: "org-mecanica",
          }),
        ],
      },
    });
    const result = await searchProjects(client, {
      query: "motor",
      stage: "prototipo",
      industry: "energia",
    });

    expect(result.ok).toBe(true);
    expect(calls[0].rpc).toBe("search_projects");
    expect(calls[0].args.p_stage).toBe("prototipo");
    expect(calls[0].args.p_industry).toBe("energia");
    if (!result.ok) return;
    expect(result.page.items[0].organization?.slug).toBe("org-mecanica");
    expect(result.page.items[0].owner?.username).toBe("carlos_mec");
  });

  it("organización ausente (LEFT JOIN) → null", async () => {
    const { client } = createSupabaseSpy({ rpcResult: { data: [projectRow()] } });
    const result = await searchProjects(client, { query: "motor" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items[0].organization).toBeNull();
  });
});

describe("searchOrganizations", () => {
  it("llama a su RPC y envía industry", async () => {
    const { client, calls } = createSupabaseSpy({ rpcResult: { data: [organizationRow()] } });
    const result = await searchOrganizations(client, { query: "mecanica", industry: "energia" });

    expect(result.ok).toBe(true);
    expect(calls[0].rpc).toBe("search_organizations");
    expect(calls[0].args.p_industry).toBe("energia");
    if (!result.ok) return;
    expect(result.page.items[0].name).toBe("Org Mecánica");
    expect(result.page.items[0].owner?.id).toBe("owner-1");
  });
});

describe("searchVideos", () => {
  it("llama a su RPC, envía language y mapea metadatos de vídeo", async () => {
    const { client, calls } = createSupabaseSpy({
      rpcResult: {
        data: [
          videoRow({
            project_id: "project-1",
            project_name: "Proyecto Motor",
            project_slug: "proyecto-motor",
          }),
        ],
      },
    });
    const result = await searchVideos(client, { query: "motor", language: "es" });

    expect(result.ok).toBe(true);
    expect(calls[0].rpc).toBe("search_videos");
    expect(calls[0].args.p_language).toBe("es");
    if (!result.ok) return;
    const item = result.page.items[0];
    expect(item.durationSeconds).toBe(120);
    expect(item.thumbnailPath).toBe("thumb/video-1.jpg");
    expect(item.project?.slug).toBe("proyecto-motor");
  });

  it("proyecto/organización ausentes → null", async () => {
    const { client } = createSupabaseSpy({ rpcResult: { data: [videoRow()] } });
    const result = await searchVideos(client, { query: "motor" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items[0].project).toBeNull();
    expect(result.page.items[0].organization).toBeNull();
  });
});
