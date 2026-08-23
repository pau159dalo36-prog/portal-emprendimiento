import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isSaved,
  listSavedOpportunities,
  listSavedPosts,
  listSavedProjects,
  save,
  toggleSave,
  unsave,
} from "@/interactions/saves";
import type { Database } from "@/types/database.types";

function createQuerySpy(options: { data?: unknown; error?: unknown } = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const result = { data: options.data, error: options.error ?? null };

  function makeBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "insert", "delete", "upsert", "order"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      calls.push({ method: "maybeSingle", args: [] });
      return builder;
    };
    builder.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      if (options.error) {
        return Promise.resolve(onRejected?.(options.error));
      }
      return Promise.resolve(onFulfilled(result));
    };
    return builder;
  }

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return makeBuilder();
    },
  };

  return { supabase: supabase as unknown as SupabaseClient<Database>, calls };
}

const POST_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID = "00000000-0000-4000-8000-000000000002";
const OPPORTUNITY_ID = "00000000-0000-4000-8000-000000000003";
const ME = "00000000-0000-4000-8000-0000000000aa";

describe("saves (capa de datos)", () => {
  it("save post usa saved_posts con upsert idempotente", async () => {
    const { supabase, calls } = createQuerySpy();
    const result = await save(supabase, ME, "post", POST_ID);

    expect(result.error).toBeNull();
    expect(calls[0].args).toEqual(["saved_posts"]);
    const upsert = calls.find((call) => call.method === "upsert");
    expect(upsert?.args[0]).toEqual({ profile_id: ME, post_id: POST_ID });
    expect(upsert?.args[1]).toEqual({
      onConflict: "profile_id, post_id",
      ignoreDuplicates: true,
    });
  });

  it("save project usa saved_projects con su FK real", async () => {
    const { supabase, calls } = createQuerySpy();
    await save(supabase, ME, "project", PROJECT_ID);

    expect(calls[0].args).toEqual(["saved_projects"]);
    const upsert = calls.find((call) => call.method === "upsert");
    expect(upsert?.args[0]).toEqual({ profile_id: ME, project_id: PROJECT_ID });
    // Guardar dos veces el mismo elemento no duplica filas ni falla.
    expect(upsert?.args[1]).toMatchObject({ ignoreDuplicates: true });
  });

  it("save opportunity usa saved_opportunities con su FK real", async () => {
    const { supabase, calls } = createQuerySpy();
    await save(supabase, ME, "opportunity", OPPORTUNITY_ID);

    expect(calls[0].args).toEqual(["saved_opportunities"]);
    const upsert = calls.find((call) => call.method === "upsert");
    expect(upsert?.args[0]).toEqual({ profile_id: ME, opportunity_id: OPPORTUNITY_ID });
  });

  it("unsave borra solo la pareja propia", async () => {
    const { supabase, calls } = createQuerySpy();
    const result = await unsave(supabase, ME, "post", POST_ID);

    expect(result.error).toBeNull();
    expect(calls.some((call) => call.method === "delete")).toBe(true);
    const eqs = calls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toContainEqual(["profile_id", ME]);
    expect(eqs).toContainEqual(["post_id", POST_ID]);
  });

  it("toggleSave alterna: guarda y luego quita", async () => {
    const notSavedYet = createQuerySpy({ data: null });
    const first = await toggleSave(notSavedYet.supabase, ME, "post", POST_ID);
    expect(first.saved).toBe(true);

    const alreadySaved = createQuerySpy({ data: { post_id: POST_ID } });
    const second = await toggleSave(alreadySaved.supabase, ME, "post", POST_ID);
    expect(second.saved).toBe(false);
    expect(alreadySaved.calls.some((call) => call.method === "delete")).toBe(true);
  });

  it("isSaved funciona para los tres tipos de destino", async () => {
    const spyPost = createQuerySpy({ data: null });
    await isSaved(spyPost.supabase, ME, "post", POST_ID);
    expect(spyPost.calls[0].args).toEqual(["saved_posts"]);

    const spyProject = createQuerySpy({ data: null });
    await isSaved(spyProject.supabase, ME, "project", PROJECT_ID);
    expect(spyProject.calls[0].args).toEqual(["saved_projects"]);

    const spyOpp = createQuerySpy({ data: null });
    await isSaved(spyOpp.supabase, ME, "opportunity", OPPORTUNITY_ID);
    expect(spyOpp.calls[0].args).toEqual(["saved_opportunities"]);
  });

  it("listados solo leen guardados propios (no enumeran ajenos)", async () => {
    const spyPosts = createQuerySpy({ data: [] });
    await listSavedPosts(spyPosts.supabase, ME);
    expect(spyPosts.calls.filter((c) => c.method === "eq").map((c) => c.args))
      .toContainEqual(["profile_id", ME]);

    const spyProjects = createQuerySpy({ data: [] });
    await listSavedProjects(spyProjects.supabase, ME);
    expect(spyProjects.calls.filter((c) => c.method === "eq").map((c) => c.args))
      .toContainEqual(["profile_id", ME]);

    const spyOpps = createQuerySpy({ data: [] });
    await listSavedOpportunities(spyOpps.supabase, ME);
    expect(spyOpps.calls.filter((c) => c.method === "eq").map((c) => c.args))
      .toContainEqual(["profile_id", ME]);
  });

  it("listSavedPosts aplana el vídeo anidado y tolera arrays vacíos", async () => {
    const spy = createQuerySpy({
      data: [
        {
          profile_id: ME,
          post_id: POST_ID,
          created_at: "2026-08-20T00:00:00Z",
          post: {
            id: POST_ID,
            body: null,
            video_id: "v1",
            video: { title: "Mi vídeo" },
          },
        },
      ],
    });
    const rows = await listSavedPosts(spy.supabase, ME);

    expect(rows).toHaveLength(1);
    expect(rows[0].post?.video_title).toBe("Mi vídeo");
  });
});
