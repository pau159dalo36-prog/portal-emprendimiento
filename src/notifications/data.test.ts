import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/notifications/data";
import type { Database } from "@/types/database.types";

const ME = "00000000-0000-4000-8000-0000000000aa";
const NOTIFICATION_ID = "00000000-0000-4000-8000-000000000001";

type Call = { method: string; args: unknown[] };

function createQuerySpy(options: { data?: unknown; error?: unknown } = {}) {
  const calls: Call[] = [];
  const result = {
    data: options.data,
    error: options.error ?? null,
    count: 0,
  };

  const builder: Record<string, unknown> = {};
  const track = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  for (const method of [
    "select",
    "eq",
    "is",
    "order",
    "limit",
    "update",
    "insert",
  ]) {
    builder[method] = track(method);
  }
  builder.maybeSingle = track("maybeSingle");
  builder.then = (onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(onFulfilled(result));

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
    rpc(fn: string, args: unknown) {
      calls.push({ method: "rpc", args: [fn, args] });
      return Promise.resolve({ data: options.data, error: options.error ?? null });
    },
  };

  return { supabase: supabase as unknown as SupabaseClient<Database>, calls };
}

describe("notifications — capa de datos", () => {
  it("listNotifications hace UNA consulta propia con actor embebido y sin datos sensibles", async () => {
    const { supabase, calls } = createQuerySpy({ data: [] });

    await listNotifications(supabase, ME);

    expect(calls.filter((call) => call.method === "from")).toHaveLength(1);
    expect(calls[0].args).toEqual(["notifications"]);
    expect(eqValue(calls, "recipient_id")).toBe(ME);
    expect(calls.find((call) => call.method === "order")?.args).toEqual([
      "created_at",
      { ascending: false },
    ]);
    const selectArg = String(calls.find((c) => c.method === "select")?.args[0]);
    for (const field of ["full_name", "username", "avatar_url", "event_type"]) {
      expect(selectArg).toContain(field);
    }
    expect(selectArg).not.toContain("contact_email");
  });

  it("getUnreadNotificationCount delega en la RPC derivada y mapea null a 0", async () => {
    const three = createQuerySpy({ data: 3 });
    expect(await getUnreadNotificationCount(three.supabase)).toBe(3);
    expect(rpcCall(three.calls)?.args[0]).toBe("get_unread_notification_count");

    const none = createQuerySpy({ data: null });
    expect(await getUnreadNotificationCount(none.supabase)).toBe(0);
  });

  it("markNotificationRead acota por id + recipient y solo si estaba sin leer", async () => {
    const ok = createQuerySpy({ data: [{ id: NOTIFICATION_ID }] });
    expect(await markNotificationRead(ok.supabase, ME, NOTIFICATION_ID)).toBe(true);
    expect(eqValue(ok.calls, "id")).toBe(NOTIFICATION_ID);
    expect(eqValue(ok.calls, "recipient_id")).toBe(ME);
    expect(isArgs(ok.calls)).toEqual(["read_at", null]);

    const miss = createQuerySpy({ data: [] });
    expect(await markNotificationRead(miss.supabase, ME, NOTIFICATION_ID)).toBe(false);
  });

  it("markAllNotificationsRead actualiza solo las propias sin leer en una UPDATE", async () => {
    const ok = createQuerySpy({ data: null });
    expect(await markAllNotificationsRead(ok.supabase, ME)).toBe(true);
    expect(eqValue(ok.calls, "recipient_id")).toBe(ME);
    expect(isArgs(ok.calls)).toEqual(["read_at", null]);
    expect(ok.calls.filter((call) => call.method === "from")).toHaveLength(1);

    const fail = createQuerySpy({ data: null, error: { code: "42501" } });
    expect(await markAllNotificationsRead(fail.supabase, ME)).toBe(false);
  });
});

function eqValue(calls: Call[], column: string): unknown {
  const found = calls.find(
    (call) => call.method === "eq" && call.args[0] === column,
  );
  return found?.args[1];
}

function isArgs(calls: Call[]): unknown[] | undefined {
  return calls.find((call) => call.method === "is")?.args;
}

function rpcCall(calls: Call[]): Call | undefined {
  return calls.find((call) => call.method === "rpc");
}
