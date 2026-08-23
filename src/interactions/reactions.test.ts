import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getPostInteractionCounts,
  isPostSupportedBy,
  togglePostSupport,
} from "@/interactions/reactions";
import type { Database } from "@/types/database.types";

function createQuerySpy(options: { data?: unknown; error?: unknown } = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const result = { data: options.data, error: options.error ?? null };

  function makeBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "insert", "delete"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      calls.push({ method: "maybeSingle", args: [] });
      return builder;
    };
    builder.then = (onFulfilled: (value: unknown) => unknown) => {
      // supabase-js resuelve siempre con { data, error }; nunca rechaza.
      return Promise.resolve(onFulfilled(result));
    };
    return builder;
  }

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return makeBuilder();
    },
    rpc(...args: unknown[]) {
      calls.push({ method: "rpc", args });
      return makeBuilder();
    },
  };

  return { supabase: supabase as unknown as SupabaseClient<Database>, calls };
}

const POST_ID = "00000000-0000-4000-8000-000000000001";
const ME = "00000000-0000-4000-8000-0000000000aa";

describe("reactions (capa de datos)", () => {
  it("isPostSupportedBy consulta la reacción propia con maybeSingle", async () => {
    const { supabase, calls } = createQuerySpy({ data: { post_id: POST_ID } });
    const supported = await isPostSupportedBy(supabase, POST_ID, ME);

    expect(supported).toBe(true);
    expect(calls[0].args).toEqual(["post_reactions"]);
    const eqs = calls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toContainEqual(["post_id", POST_ID]);
    expect(eqs).toContainEqual(["profile_id", ME]);
    expect(eqs).toContainEqual(["reaction_type", "support"]);
  });

  it("togglePostSupport (react) llama a la RPC idempotente", async () => {
    const { supabase, calls } = createQuerySpy({ data: true });
    const result = await togglePostSupport(supabase, POST_ID);

    expect(result).toEqual({ supported: true, error: null });
    expect(
      calls.find((call) => call.method === "rpc")?.args,
    ).toEqual(["toggle_post_support", { p_post_id: POST_ID }]);
  });

  it("duplicate/toggle off: la RPC devuelve false al quitar el apoyo", async () => {
    // El UNIQUE (post, perfil, tipo) + la RPC hacen que repetir o alternar
    // sea siempre idempotente; la capa de datos solo expone el resultado.
    const { supabase, calls } = createQuerySpy({ data: false });
    const result = await togglePostSupport(supabase, POST_ID);

    expect(result.supported).toBe(false);
    expect(calls.filter((call) => call.method === "rpc")).toHaveLength(1);
  });

  it("mapea POST_NOT_INTERACTABLE a NOT_ALLOWED (privacidad/bloqueos)", async () => {
    const { supabase } = createQuerySpy({
      error: { message: 'POST_NOT_INTERACTABLE' },
    });
    const result = await togglePostSupport(supabase, POST_ID);

    expect(result.error).toBe("NOT_ALLOWED");
    expect(result.supported).toBeNull();
  });

  it("getPostInteractionCounts agrega por RPC y no consulta si la lista está vacía", async () => {
    const empty = createQuerySpy();
    expect((await getPostInteractionCounts(empty.supabase, [])).size).toBe(0);
    expect(empty.calls).toHaveLength(0);

    const spy = createQuerySpy({
      data: [
        { post_id: POST_ID, comment_count: 3, support_count: 12 },
      ],
    });
    const counts = await getPostInteractionCounts(spy.supabase, [POST_ID]);

    expect(counts.get(POST_ID)).toEqual({
      postId: POST_ID,
      commentCount: 3,
      supportCount: 12,
    });
  });
});

