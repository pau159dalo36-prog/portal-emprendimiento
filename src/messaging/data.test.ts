import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getConversationCounterpart,
  getOrCreateDm,
  getUnreadMessagesTotal,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
} from "@/messaging/data";
import type { Database } from "@/types/database.types";

const ME = "00000000-0000-4000-8000-0000000000aa";
const OTHER = "00000000-0000-4000-8000-0000000000bb";
const CONVERSATION = "00000000-0000-4000-8000-000000000001";
const OLD = "2026-01-01T10:00:00.000Z";
const NEW = "2026-08-24T12:00:00.000Z";
const COUNTERPART = {
  id: OTHER,
  username: "other",
  full_name: "Other",
  avatar_url: null,
};

type Call = { method: string; args: unknown[]; table?: string };

/** Spy encadenable: cada tabla sirve una lista de respuestas EN ORDEN de uso
 * (una por consulta iniciada sobre esa tabla), como ocurre en producción. */
function createSpy(
  queue: Record<string, Array<{ data?: unknown; error?: unknown }>> = {},
) {
  const calls: Call[] = [];

  function next(table: string): { data?: unknown; error?: unknown } {
    const items = queue[table] ?? [];
    return items.shift() ?? { data: null };
  }

  function builderFor(table: string) {
    const builder: Record<string, unknown> = {};
    const track =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ method, args, table });
        return builder;
      };
    for (const method of [
      "select",
      "eq",
      "neq",
      "in",
      "is",
      "order",
      "limit",
      "update",
      "insert",
    ]) {
      builder[method] = track(method);
    }
    builder.maybeSingle = track("maybeSingle");
    builder.single = track("single");
    builder.then = (onFulfilled: (value: unknown) => unknown) => {
      const handler = next(table);
      return Promise.resolve(onFulfilled({ ...handler, count: 0 }));
    };
    return builder;
  }

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", args: [table], table });
      return builderFor(table);
    },
    rpc(fn: string) {
      const handler = next(`rpc:${fn}`);
      calls.push({ method: "rpc", args: [fn] });
      return Promise.resolve({ ...handler });
    },
  };

  return { supabase: supabase as unknown as SupabaseClient<Database>, calls };
}

function fromCalls(calls: Call[]): number {
  return calls.filter((call) => call.method === "from").length;
}

describe("messaging — capa de datos", () => {
  it("getOrCreateDm delega en la RPC con actor implícito (nunca del cliente)", async () => {
    const { supabase, calls } = createSpy({
      "rpc:get_or_create_dm": [{ data: CONVERSATION }],
    });

    const result = await getOrCreateDm(supabase, OTHER);

    expect(result).toEqual({ conversationId: CONVERSATION, error: null });
    const rpc = calls.find((call) => call.method === "rpc");
    expect(rpc?.args[0]).toBe("get_or_create_dm");
  });

  it("getOrCreateDm mapea los códigos SQL a errores traducibles", async () => {
    for (const [sqlMessage, expected] of [
      ["AUTH_REQUIRED", "AUTH_REQUIRED"],
      ["SELF_DM_DENIED", "SELF_DM_DENIED"],
      ["TARGET_NOT_FOUND", "TARGET_NOT_FOUND"],
      ["get_or_create_dm() BLOCKED", "BLOCKED"],
      ["otro error", "FAILED"],
    ] as const) {
      const { supabase } = createSpy({
        "rpc:get_or_create_dm": [{ data: null, error: { message: sqlMessage } }],
      });
      const result = await getOrCreateDm(supabase, OTHER);
      expect(result.error).toBe(expected);
      expect(result.conversationId).toBeNull();
    }
  });

  it("listConversations resuelve listado+unread+último mensaje en ≤4 consultas fijas (sin N+1)", async () => {
    const { supabase, calls } = createSpy({
      // 1ª lectura de members: mis membresías; 2ª: contrapartes ajenas.
      conversation_members: [
        { data: [{ conversation_id: CONVERSATION, last_read_at: OLD }] },
        {
          data: [
            { conversation_id: CONVERSATION, profile: COUNTERPART },
          ],
        },
      ],
      conversations: [{ data: [{ id: CONVERSATION, last_message_at: NEW }] }],
      messages: [
        {
          data: [
            {
              id: "m2",
              conversation_id: CONVERSATION,
              sender_id: ME,
              body: "mío reciente",
              created_at: NEW,
            },
            {
              id: "m3",
              conversation_id: CONVERSATION,
              sender_id: OTHER,
              body: "suyo nuevo",
              created_at: NEW,
            },
            {
              id: "m4",
              conversation_id: CONVERSATION,
              sender_id: OTHER,
              body: "suyo antiguo",
              created_at: OLD,
            },
          ],
        },
      ],
    });

    const items = await listConversations(supabase, ME);

    expect(fromCalls(calls)).toBeLessThanOrEqual(4); // fijo: no crece con N
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(CONVERSATION);
    expect(items[0].counterpart.id).toBe(OTHER);
    // Unread derivado: solo m3 (de la contraparte y posterior a mi last_read_at).
    expect(items[0].unreadCount).toBe(1);
    expect(items[0].lastMessage?.body).toBe("mío reciente");
  });

  it("listConversations omite conversaciones sin contraparte visible", async () => {
    const { supabase } = createSpy({
      conversation_members: [
        { data: [{ conversation_id: CONVERSATION, last_read_at: OLD }] },
        { data: [] }, // sin miembro ajeno visible
      ],
      conversations: [{ data: [{ id: CONVERSATION, last_message_at: NEW }] }],
      messages: [{ data: [] }],
    });

    const items = await listConversations(supabase, ME);

    expect(items).toEqual([]);
  });

  it("getConversationCounterpart devuelve null si no soy miembro (1 sola consulta)", async () => {
    const empty = createSpy({ conversation_members: [{ data: null }] });
    expect(
      await getConversationCounterpart(empty.supabase, ME, CONVERSATION),
    ).toBeNull();
    expect(fromCalls(empty.calls)).toBe(1);

    const member = createSpy({
      conversation_members: [
        { data: { conversation_id: CONVERSATION } },
        { data: { profile: COUNTERPART } },
      ],
    });
    const counterpart = await getConversationCounterpart(member.supabase, ME, CONVERSATION);
    expect(counterpart?.id).toBe(OTHER);
    expect(fromCalls(member.calls)).toBe(2);
  });

  it("listMessages ordena cronológico ascendente con límite acotado", async () => {
    const { supabase, calls } = createSpy({ messages: [{ data: [] }] });

    await listMessages(supabase, CONVERSATION);

    const eq = calls.find((call) => call.method === "eq" && call.args[0] === "conversation_id");
    expect(eq?.args[1]).toBe(CONVERSATION);
    expect(calls.find((call) => call.method === "order")?.args).toEqual([
      "created_at",
      { ascending: true },
    ]);
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([200]);
  });

  it("sendMessage valida trim/longitud ANTES de tocar la BD", async () => {
    const untouched = createSpy();
    expect((await sendMessage(untouched.supabase, CONVERSATION, ME, "   ")).error).toBe(
      "EMPTY_BODY",
    );
    expect(
      (await sendMessage(untouched.supabase, CONVERSATION, ME, "x".repeat(2001)))
        .error,
    ).toBe("BODY_TOO_LONG");
    expect(untouched.calls.filter((call) => call.method === "insert")).toHaveLength(0);
  });

  it("sendMessage inserta el body recortado con remitente de sesión", async () => {
    const ok = createSpy({
      messages: [
        {
          data: {
            id: "m1",
            conversation_id: CONVERSATION,
            sender_id: ME,
            body: "hola",
            created_at: NEW,
            edited_at: null,
          },
        },
      ],
    });

    const sent = await sendMessage(ok.supabase, CONVERSATION, ME, "  hola  ");

    expect(sent.error).toBeNull();
    expect(sent.message?.body).toBe("hola");
    const insert = ok.calls.find((call) => call.method === "insert");
    expect(insert?.args[0]).toMatchObject({
      conversation_id: CONVERSATION,
      sender_id: ME,
      body: "hola",
    });
  });

  it("sendMessage mapea fallos RLS/SQL a códigos traducibles", async () => {
    const rls = createSpy({
      messages: [
        {
          data: null,
          error: {
            message: 'new row violates row-level security policy for table "messages"',
          },
        },
      ],
    });
    expect((await sendMessage(rls.supabase, CONVERSATION, ME, "hola")).error).toBe(
      "FAILED",
    );

    const explicit = createSpy({
      messages: [{ data: null, error: { message: "BLOCKED" } }],
    });
    expect((await sendMessage(explicit.supabase, CONVERSATION, ME, "hola")).error).toBe(
      "BLOCKED",
    );
  });

  it("markConversationRead actualiza solo la propia membresía del hilo", async () => {
    const { supabase, calls } = createSpy({ conversation_members: [{ data: null }] });

    expect(await markConversationRead(supabase, ME, CONVERSATION)).toBe(true);

    expect(calls.find((call) => call.method === "update")?.args[0]).toMatchObject({
      last_read_at: expect.any(String),
    });
    expect(
      calls.find((c) => c.method === "eq" && c.args[0] === "conversation_id")?.args[1],
    ).toBe(CONVERSATION);
    expect(
      calls.find((c) => c.method === "eq" && c.args[0] === "profile_id")?.args[1],
    ).toBe(ME);
  });

  it("getUnreadMessagesTotal delega en la RPC derivada fail-closed", async () => {
    const some = createSpy({ "rpc:get_unread_messages_total": [{ data: 7 }] });
    expect(await getUnreadMessagesTotal(some.supabase)).toBe(7);

    const none = createSpy({ "rpc:get_unread_messages_total": [{ data: null }] });
    expect(await getUnreadMessagesTotal(none.supabase)).toBe(0);
  });
});
