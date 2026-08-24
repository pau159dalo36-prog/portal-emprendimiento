import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canManageOpportunity,
  getApplicationCounts,
  getMyApplicationForOpportunity,
  listMyApplications,
  listOpportunityApplications,
} from "@/applications/data";
import type { Database } from "@/types/database.types";

const OPPORTUNITY_ID = "00000000-0000-4000-8000-000000000001";
const ME = "00000000-0000-4000-8000-0000000000aa";

type Call = { method: string; args: unknown[] };

function createQuerySpy(options: { data?: unknown; error?: unknown } = {}) {
  const calls: Call[] = [];
  const result = { data: options.data, error: options.error ?? null };

  const builder = {
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return builder;
    },
    order(...args: unknown[]) {
      calls.push({ method: "order", args });
      return builder;
    },
    maybeSingle() {
      calls.push({ method: "maybeSingle", args: [] });
      return builder;
    },
    then(
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      if (options.error) {
        return Promise.resolve(onRejected?.(options.error));
      }
      return Promise.resolve(onFulfilled(result));
    },
  };

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
    rpc(fn: string, args: unknown) {
      calls.push({ method: "rpc", args: [fn, args] });
      // Las RPC devuelven { data, error }, no un builder encadenable.
      return Promise.resolve(result);
    },
  };

  return {
    supabase: supabase as unknown as SupabaseClient<Database>,
    calls,
  };
}

function tableCall(calls: Call[], table: string) {
  return calls.find((call) => call.method === "from" && call.args[0] === table);
}

function eqArgs(calls: Call[], column: string) {
  return calls.find((call) => call.method === "eq" && call.args[0] === column)?.args;
}

describe("applications — capa de datos", () => {
  it("getMyApplicationForOpportunity filtra por oportunidad y applicant", async () => {
    const { supabase, calls } = createQuerySpy({ data: null });

    await getMyApplicationForOpportunity(supabase, ME, OPPORTUNITY_ID);

    expect(tableCall(calls, "applications")).toBeDefined();
    expect(eqArgs(calls, "opportunity_id")).toEqual(["opportunity_id", OPPORTUNITY_ID]);
    expect(eqArgs(calls, "applicant_id")).toEqual(["applicant_id", ME]);
    expect(calls.at(-1)?.method).toBe("maybeSingle");
  });

  it("listMyApplications ordena por created_at descendente en una sola consulta", async () => {
    const { supabase, calls } = createQuerySpy({ data: [] });

    const rows = await listMyApplications(supabase, ME);

    expect(rows).toEqual([]);
    expect(calls.filter((call) => call.method === "from")).toHaveLength(1);
    expect(eqArgs(calls, "applicant_id")).toEqual(["applicant_id", ME]);
    expect(calls.find((call) => call.method === "order")?.args).toEqual([
      "created_at",
      { ascending: false },
    ]);
  });

  it("listOpportunityApplications pide solo el payload público del candidato", async () => {
    const { supabase, calls } = createQuerySpy({
      data: [
        {
          id: "a1",
          status: "submitted",
          message: "hola",
          applicant: {
            id: ME,
            full_name: "Ana",
            username: "ana",
            avatar_url: null,
            headline: "Dev",
            location: "Madrid",
            user_types: [],
          },
        },
      ],
    });

    const rows = await listOpportunityApplications(supabase, OPPORTUNITY_ID);

    expect(rows).toHaveLength(1);
    expect(tableCall(calls, "applications")).toBeDefined();
    expect(eqArgs(calls, "opportunity_id")).toEqual(["opportunity_id", OPPORTUNITY_ID]);

    const selectArg = String(calls.find((call) => call.method === "select")?.args[0]);
    for (const publicField of ["full_name", "username", "avatar_url", "headline"]) {
      expect(selectArg).toContain(publicField);
    }
    for (const privateField of ["contact_email", "phone", "timezone"]) {
      expect(selectArg).not.toContain(privateField);
    }
  });

  it("getApplicationCounts hace UNA llamada RPC sin N+1 y mapea a Map", async () => {
    const { supabase, calls } = createQuerySpy({
      data: [
        { opportunity_id: OPPORTUNITY_ID, total: 7, accepted_count: 2 },
        {
          opportunity_id: "00000000-0000-4000-8000-000000000002",
          total: 0,
          accepted_count: 0,
        },
      ],
    });

    const counts = await getApplicationCounts(supabase, [
      OPPORTUNITY_ID,
      "00000000-0000-4000-8000-000000000002",
    ]);

    expect(counts.get(OPPORTUNITY_ID)).toEqual({ total: 7, acceptedCount: 2 });
    expect(counts.get("00000000-0000-4000-8000-000000000002")).toEqual({
      total: 0,
      acceptedCount: 0,
    });
    expect(calls.filter((call) => call.method === "rpc")).toHaveLength(1);
  });

  it("getApplicationCounts con lista vacía no consulta la BD", async () => {
    const { supabase, calls } = createQuerySpy();

    const counts = await getApplicationCounts(supabase, []);

    expect(counts.size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("canManageOpportunity delega en la RPC can_manage_opportunity", async () => {
    const { supabase, calls } = createQuerySpy({ data: true });

    const allowed = await canManageOpportunity(supabase, OPPORTUNITY_ID);

    expect(allowed).toBe(true);
    expect(calls.find((call) => call.method === "rpc")?.args).toEqual([
      "can_manage_opportunity",
      { p_opportunity_id: OPPORTUNITY_ID },
    ]);
  });
});
