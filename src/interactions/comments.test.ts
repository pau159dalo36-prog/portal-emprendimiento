import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createComment,
  deleteOwnComment,
  listCommentsForPost,
  setOwnCommentHidden,
  updateOwnComment,
} from "@/interactions/comments";
import { commentBodySchema } from "@/validations/interactions";
import type { Database } from "@/types/database.types";

function createQuerySpy(options: { data?: unknown; error?: unknown } = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const result = { data: options.data, error: options.error ?? null };

  function makeBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    const chainable = ["select", "eq", "order", "insert", "update", "delete", "upsert"];
    for (const method of chainable) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      calls.push({ method: "maybeSingle", args: [] });
      return builder;
    };
    builder.single = () => {
      calls.push({ method: "single", args: [] });
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
  };

  return { supabase: supabase as unknown as SupabaseClient<Database>, calls };
}

const POST_ID = "00000000-0000-4000-8000-000000000001";
const PARENT_ID = "00000000-0000-4000-8000-000000000002";
const ME = "00000000-0000-4000-8000-0000000000aa";

describe("comments (capa de datos)", () => {
  it("create inserta comentario raíz con body recortado", async () => {
    const { supabase, calls } = createQuerySpy({ data: { id: "c1" } });
    const result = await createComment(supabase, ME, {
      postId: POST_ID,
      parentId: null,
      body: "  Hola mundo  ",
    });

    expect(result.id).toBe("c1");
    expect(result.error).toBeNull();
    const insert = calls.find((call) => call.method === "insert");
    expect(insert?.args[0]).toEqual({
      post_id: POST_ID,
      author_id: ME,
      parent_id: null,
      body: "Hola mundo",
    });
  });

  it("create admite respuesta (parent_id) sobre el mismo post", async () => {
    const { supabase, calls } = createQuerySpy({ data: { id: "c2" } });
    await createComment(supabase, ME, {
      postId: POST_ID,
      parentId: PARENT_ID,
      body: "respuesta",
    });

    const insert = calls.find((call) => call.method === "insert");
    expect(insert?.args[0]).toMatchObject({ parent_id: PARENT_ID });
  });

  it("create rechaza body vacío sin consultar la BD", async () => {
    const { supabase, calls } = createQuerySpy();
    const result = await createComment(supabase, ME, {
      postId: POST_ID,
      parentId: null,
      body: "   ",
    });

    expect(result.error).toBe("EMPTY_BODY");
    expect(calls).toHaveLength(0);
  });

  it("create rechaza body demasiado largo sin consultar la BD", async () => {
    const { supabase, calls } = createQuerySpy();
    const result = await createComment(supabase, ME, {
      postId: POST_ID,
      parentId: null,
      body: "a".repeat(2001),
    });

    expect(result.error).toBe("BODY_TOO_LONG");
    expect(calls).toHaveLength(0);
  });

  it("updateOwnComment edita solo el propio comentario", async () => {
    const { supabase, calls } = createQuerySpy({ data: [{ id: PARENT_ID }] });
    const result = await updateOwnComment(supabase, ME, PARENT_ID, "editado");

    expect(result.error).toBeNull();
    const update = calls.find((call) => call.method === "update");
    expect(update?.args[0]).toEqual({ body: "editado" });
    const eqs = calls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toContainEqual(["id", PARENT_ID]);
    expect(eqs).toContainEqual(["author_id", ME]);
  });

  it("updateOwnComment deniega edición ajena (sin filas afectadas)", async () => {
    const { supabase } = createQuerySpy({ data: [] });
    const result = await updateOwnComment(supabase, ME, PARENT_ID, "hack");

    expect(result.error).toBe("NOT_OWN_COMMENT");
  });

  it("deleteOwnComment borra solo el par propio", async () => {
    const { supabase, calls } = createQuerySpy({ data: [{ id: PARENT_ID }] });
    const result = await deleteOwnComment(supabase, ME, PARENT_ID);

    expect(result.error).toBeNull();
    expect(calls.some((call) => call.method === "delete")).toBe(true);
    const eqs = calls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toContainEqual(["author_id", ME]);
  });

  it("setOwnCommentHidden oculta el propio comentario (soft-delete)", async () => {
    const { supabase, calls } = createQuerySpy({ data: [{ id: PARENT_ID }] });
    const result = await setOwnCommentHidden(supabase, ME, PARENT_ID, true);

    expect(result.error).toBeNull();
    const update = calls.find((call) => call.method === "update");
    expect(update?.args[0]).toEqual({ is_hidden: true });
  });

  it("mapea COMMENT_PARENT_INVALID a INVALID_PARENT", async () => {
    const { supabase } = createQuerySpy({ error: { message: "COMMENT_PARENT_INVALID" } });
    const result = await createComment(supabase, ME, {
      postId: POST_ID,
      parentId: PARENT_ID,
      body: "x",
    });

    expect(result.error).toBe("INVALID_PARENT");
  });

  it("listCommentsForPost ordena por created_at ascendente", async () => {
    const { supabase, calls } = createQuerySpy({ data: [] });
    await listCommentsForPost(supabase, POST_ID);

    expect(calls[0].args).toEqual(["post_comments"]);
    const order = calls.find((call) => call.method === "order");
    expect(order?.args).toEqual(["created_at", { ascending: true }]);
  });

  it("commentBodySchema: vacío falla, 2000 pasa", () => {
    expect(commentBodySchema.safeParse("").success).toBe(false);
    expect(commentBodySchema.safeParse("   ").success).toBe(false);
    expect(commentBodySchema.safeParse("a".repeat(2000)).success).toBe(true);
    expect(commentBodySchema.safeParse("a".repeat(2001)).success).toBe(false);
  });
});
