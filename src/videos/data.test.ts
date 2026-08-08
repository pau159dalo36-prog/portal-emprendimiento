import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  VIDEO_DISTRIBUTABLE_MODERATION_STATUSES,
  VIDEO_MODERATION_STATUSES,
  VIDEO_PROCESSING_STATUSES,
  VIDEO_PUBLICATION_STATUSES,
  VIDEO_VISIBILITIES,
} from "@/config/video";
import {
  isVerticalVideo,
  listPublishedVideos,
  listPublishedVideosForOrganization,
  listPublishedVideosForProject,
} from "@/videos/data";
import type { Database } from "@/types/database.types";
import type { VideoWithDetails } from "@/videos/types";

const base = {
  id: "00000000-0000-0000-0000-000000000000",
  owner_id: "00000000-0000-0000-0000-000000000001",
  project_id: null,
  organization_id: null,
  storage_bucket: "public-videos",
  storage_path: "u/v/video.mp4",
  original_filename: "video.mp4",
  mime_type: "video/mp4",
  size_bytes: 1000,
  duration_seconds: 10,
  width: 1280,
  height: 720,
  aspect_ratio: null,
  thumbnail_path: null,
  poster_path: null,
  thumbnail_bucket: null,
  poster_bucket: null,
  captions_path: null,
  transcript: null,
  original_language: "es",
  title: "Vídeo de prueba",
  caption: null,
  processing_status: "ready",
  moderation_status: "unreviewed",
  moderated_by: null,
  moderated_at: null,
  moderation_reason: null,
  visibility: "public",
  status: "published",
  published_at: "2026-08-01T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  owner: null,
  project: null,
  organization: null,
} satisfies VideoWithDetails;

describe("isVerticalVideo", () => {
  it("devuelve true para vídeos verticales (altura mayor que anchura)", () => {
    expect(isVerticalVideo({ ...base, width: 720, height: 1280 })).toBe(true);
  });

  it("devuelve false para vídeos horizontales", () => {
    expect(isVerticalVideo({ ...base, width: 1280, height: 720 })).toBe(false);
  });

  it("devuelve false para vídeos cuadrados", () => {
    expect(isVerticalVideo({ ...base, width: 1080, height: 1080 })).toBe(false);
  });

  it("devuelve false cuando faltan las dimensiones", () => {
    expect(isVerticalVideo({ ...base, width: null, height: null })).toBe(false);
    expect(isVerticalVideo({ ...base, width: 720, height: null })).toBe(false);
    expect(isVerticalVideo({ ...base, width: null, height: 1280 })).toBe(false);
  });
});

describe("listPublishedVideos", () => {
  it("es una función que acepta un cliente de supabase (firma de llamada)", () => {
    expect(typeof listPublishedVideos).toBe("function");
  });
});

function createQuerySpy() {
  const calls: { method: string; args: unknown[] }[] = [];
  const handler: ProxyHandler<object> = {
    get(_target, prop, receiver) {
      if (prop === "then") {
        return undefined;
      }
      if (typeof prop !== "string") {
        return undefined;
      }
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return receiver;
      };
    },
  };
  const builder = new Proxy({}, handler);
  const supabase = { from: () => builder };
  return {
    supabase: supabase as unknown as SupabaseClient<Database>,
    calls,
  };
}

function filterCalls(
  calls: { method: string; args: unknown[] }[],
  method: string,
  column: string,
) {
  return calls.find((call) => call.method === method && call.args[0] === column)?.args;
}

describe("listados públicos (moderación post-publicación)", () => {
  it("lista vídeos publicados y listos cuyo estado de moderación es distributable", async () => {
    const { supabase, calls } = createQuerySpy();
    await listPublishedVideos(supabase);

    expect(filterCalls(calls, "eq", "status")?.[1]).toBe("published");
    expect(filterCalls(calls, "eq", "processing_status")?.[1]).toBe("ready");
    expect(filterCalls(calls, "in", "moderation_status")?.[1]).toEqual([
      "unreviewed",
      "approved",
    ]);
  });

  it("no incluye los vídeos 'unlisted' en los listados públicos", async () => {
    const { supabase, calls } = createQuerySpy();
    await listPublishedVideos(supabase);

    expect(filterCalls(calls, "neq", "visibility")?.[1]).toBe("unlisted");
  });

  it("aplica los mismos filtros de moderación y unlisted en proyecto y organización", async () => {
    const { supabase: supabaseProject, calls: projectCalls } = createQuerySpy();
    await listPublishedVideosForProject(supabaseProject, "project-1");
    expect(filterCalls(projectCalls, "in", "moderation_status")?.[1]).toEqual([
      "unreviewed",
      "approved",
    ]);
    expect(filterCalls(projectCalls, "neq", "visibility")?.[1]).toBe("unlisted");

    const { supabase: supabaseOrg, calls: orgCalls } = createQuerySpy();
    await listPublishedVideosForOrganization(supabaseOrg, "org-1");
    expect(filterCalls(orgCalls, "in", "moderation_status")?.[1]).toEqual([
      "unreviewed",
      "approved",
    ]);
    expect(filterCalls(orgCalls, "neq", "visibility")?.[1]).toBe("unlisted");
  });
});

describe("matriz de distribución pública (moderación post-publicación)", () => {
  it("published + public + ready + unreviewed => aparece en el listado público", () => {
    expect(VIDEO_DISTRIBUTABLE_MODERATION_STATUSES).toContain("unreviewed");
    expect(VIDEO_DISTRIBUTABLE_MODERATION_STATUSES).toEqual(["unreviewed", "approved"]);
  });

  it("published + public + ready + approved => aparece en el listado público", () => {
    expect(VIDEO_DISTRIBUTABLE_MODERATION_STATUSES).toContain("approved");
  });

  it("rejected => NO aparece (fuera del conjunto distributable)", () => {
    expect(VIDEO_DISTRIBUTABLE_MODERATION_STATUSES).not.toContain("rejected");
    expect(VIDEO_MODERATION_STATUSES).toContain("rejected");
  });

  it("flagged => NO aparece (fuera del conjunto distributable)", () => {
    expect(VIDEO_DISTRIBUTABLE_MODERATION_STATUSES).not.toContain("flagged");
    expect(VIDEO_MODERATION_STATUSES).toContain("flagged");
  });

  it("el conjunto distributable es exactamente unreviewed + approved", () => {
    const noDistribuibles = VIDEO_MODERATION_STATUSES.filter(
      (status) =>
        !(VIDEO_DISTRIBUTABLE_MODERATION_STATUSES as readonly string[]).includes(status),
    );
    expect(noDistribuibles).toEqual(["rejected", "flagged"]);
  });

  it("draft/archived/hidden/removed (retirado) => NO aparecen: el listado solo pide status=published", async () => {
    const { supabase, calls } = createQuerySpy();
    await listPublishedVideos(supabase);

    const publishedFilter = filterCalls(calls, "eq", "status")?.[1];
    expect(publishedFilter).toBe("published");
    const publicables = VIDEO_PUBLICATION_STATUSES.filter((s) => s === publishedFilter);
    expect(publicables).toEqual(["published"]);
    expect(publicables).not.toContain("draft");
    expect(publicables).not.toContain("archived");
    expect(publicables).not.toContain("hidden");
    expect(publicables).not.toContain("removed");
  });

  it("vídeos no listos (uploading/uploaded/validating/failed) => NO aparecen: el listado solo pide processing_status=ready", async () => {
    const { supabase, calls } = createQuerySpy();
    await listPublishedVideos(supabase);

    const readyFilter = filterCalls(calls, "eq", "processing_status")?.[1];
    expect(readyFilter).toBe("ready");
    const listables = VIDEO_PROCESSING_STATUSES.filter((s) => s === readyFilter);
    expect(listables).toEqual(["ready"]);
  });

  it("unlisted => NO aparece en el listado; public sí es la visibilidad servida", async () => {
    const { supabase, calls } = createQuerySpy();
    await listPublishedVideos(supabase);

    expect(filterCalls(calls, "neq", "visibility")?.[1]).toBe("unlisted");
    expect(VIDEO_VISIBILITIES).toContain("public");
    expect(VIDEO_VISIBILITIES).toContain("private");
  });
});
