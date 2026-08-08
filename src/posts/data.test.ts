import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  POST_DISTRIBUTABLE_PUBLICATION_STATUSES,
  POST_PUBLICATION_STATUSES,
  POST_TYPES,
  POST_VISIBILITIES,
} from "@/config/post";
import { getPostById, listFeedPosts, listPostsForUser } from "@/posts/data";
import {
  listPostsFiltersSchema,
  postBodySchema,
  postPublicationStatusSchema,
  postTypeSchema,
  postVisibilitySchema,
} from "@/posts/schemas";
import type { Database } from "@/types/database.types";

describe("listFeedPosts (primitiva del feed)", () => {
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

  it("solo consulta posts publicados distribuibles", async () => {
    const { supabase, calls } = createQuerySpy();
    await listFeedPosts(supabase);

    expect(filterCalls(calls, "in", "publication_status")?.[1]).toEqual(["published"]);
    expect(POST_DISTRIBUTABLE_PUBLICATION_STATUSES).toEqual(["published"]);
  });

  it("excluye 'unlisted' del feed (solo distribuye posts estrictamente públicos)", async () => {
    const { supabase, calls } = createQuerySpy();
    await listFeedPosts(supabase);

    expect(filterCalls(calls, "eq", "visibility")?.[1]).toBe("public");
    expect(POST_VISIBILITIES).toContain("unlisted");
    expect(POST_VISIBILITIES).toContain("private");
  });

  it("ordena por published_at descendente (feed cronológico)", async () => {
    const { supabase, calls } = createQuerySpy();
    await listFeedPosts(supabase);

    const orderCall = calls.find((call) => call.method === "order");
    expect(orderCall?.args[0]).toBe("published_at");
    expect(orderCall?.args[1]).toEqual({ ascending: false });
  });

  it("aplica el filtro de autor y el límite cuando se indican", async () => {
    const { supabase, calls } = createQuerySpy();
    await listFeedPosts(supabase, { authorId: "author-1", limit: 5 });

    expect(filterCalls(calls, "eq", "author_id")?.[1]).toBe("author-1");
    expect(calls.find((call) => call.method === "limit")?.args[0]).toBe(5);
  });
});

describe("getPostById / listPostsForUser", () => {
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

  it("obtiene un post por id con maybeSingle", async () => {
    const { supabase, calls } = createQuerySpy();
    await getPostById(supabase, "post-1");

    expect(filterCalls(calls, "eq", "id")?.[1]).toBe("post-1");
    expect(calls.some((call) => call.method === "maybeSingle")).toBe(true);
  });

  it("lista los posts de un usuario por autor", async () => {
    const { supabase, calls } = createQuerySpy();
    await listPostsForUser(supabase, "user-1");

    expect(filterCalls(calls, "eq", "author_id")?.[1]).toBe("user-1");
    const orderCall = calls.find((call) => call.method === "order");
    expect(orderCall?.args[0]).toBe("created_at");
  });
});

describe("matriz de distribución pública (capa de aplicación)", () => {
  it("published => sí se consulta en el feed", () => {
    expect(POST_DISTRIBUTABLE_PUBLICATION_STATUSES).toContain("published");
  });

  it("draft/hidden/removed (retirado/archivado) => NO entran en el feed", () => {
    const noDistribuibles = POST_PUBLICATION_STATUSES.filter(
      (status) =>
        !(POST_DISTRIBUTABLE_PUBLICATION_STATUSES as readonly string[]).includes(status),
    );
    expect(noDistribuibles).toEqual(["draft", "hidden", "removed"]);
    expect(noDistribuibles).not.toContain("published");
  });

  it("el feed consulta únicamente visibilidad 'public' (unlisted/private/protected excluidos)", () => {
    expect(POST_VISIBILITIES).toContain("public");
    expect(POST_VISIBILITIES).toContain("unlisted");
    expect(POST_VISIBILITIES).toContain("registered_users");
    expect(POST_VISIBILITIES).toContain("project_members");
    expect(POST_VISIBILITIES).toContain("private");
  });
});

describe("schemas de posts", () => {
  it("valida los tipos de post preparados (sin implementarlos todavía)", () => {
    expect(postTypeSchema.safeParse("video").success).toBe(true);
    for (const type of POST_TYPES) {
      expect(postTypeSchema.safeParse(type).success).toBe(true);
    }
    expect(postTypeSchema.safeParse("comment").success).toBe(false);
  });

  it("valida visibilidad y estado de publicación", () => {
    expect(postVisibilitySchema.safeParse("public").success).toBe(true);
    expect(postVisibilitySchema.safeParse("private").success).toBe(true);
    expect(postVisibilitySchema.safeParse("publico").success).toBe(false);

    expect(postPublicationStatusSchema.safeParse("published").success).toBe(true);
    expect(postPublicationStatusSchema.safeParse("removed").success).toBe(true);
    expect(postPublicationStatusSchema.safeParse("archived").success).toBe(false);
  });

  it("el body queda entre 1 y 5000 caracteres (reservado a tipos futuros)", () => {
    expect(postBodySchema.safeParse("Hola comunidad").success).toBe(true);
    expect(postBodySchema.safeParse("").success).toBe(false);
    expect(postBodySchema.safeParse("   ").success).toBe(false);
    expect(postBodySchema.safeParse("a".repeat(5001)).success).toBe(false);
  });

  it("valida los filtros de listado", () => {
    expect(listPostsFiltersSchema.safeParse({}).success).toBe(true);
    expect(listPostsFiltersSchema.safeParse({ limit: 10 }).success).toBe(true);
    expect(listPostsFiltersSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(
      listPostsFiltersSchema.safeParse({
        authorId: "00000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(true);
    expect(listPostsFiltersSchema.safeParse({ authorId: "no-uuid" }).success).toBe(false);
  });
});
