import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptApplicationAction,
  applyToOpportunityAction,
  markApplicationViewedAction,
  rejectApplicationAction,
  withdrawApplicationAction,
} from "@/actions/application";

const ME = "00000000-0000-4000-8000-0000000000aa";
const OPPORTUNITY_ID = "00000000-0000-4000-8000-000000000001";
const APPLICATION_ID = "00000000-0000-4000-8000-000000000002";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const requireUserMock = vi.fn();
vi.mock("@/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

type Call = { method: string; args: unknown[] };

// Falso cliente Supabase que registra las consultas encadenadas.
function createSupabaseSpy(options: { error?: { code?: string | null } | null } = {}) {
  const calls: Call[] = [];
  const builder = {
    insert(payload: unknown) {
      calls.push({ method: "insert", args: [payload] });
      return Promise.resolve({ error: options.error ?? null });
    },
    update(payload: unknown) {
      calls.push({ method: "update", args: [payload] });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return builder;
    },
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return Promise.resolve({
        data: options.error ? [] : [{ id: APPLICATION_ID }],
        error: options.error ?? null,
      });
    },
  };

  return {
    supabase: {
      from(table: string) {
        calls.push({ method: "from", args: [table] });
        return builder;
      },
    },
    calls,
  };
}

function formWith(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("acciones de candidaturas", () => {
  let spy: ReturnType<typeof createSupabaseSpy>;

  beforeEach(() => {
    spy = createSupabaseSpy();
    requireUserMock.mockResolvedValue({
      supabase: spy.supabase as never,
      user: { id: ME },
    });
  });

  afterEach(() => {
    requireUserMock.mockReset();
  });

  it("anon no puede aplicar: requireUser redirige", async () => {
    requireUserMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      applyToOpportunityAction(
        { status: "idle" },
        formWith({ opportunity_id: OPPORTUNITY_ID }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("applyToOpportunityAction crea la candidatura con applicant_id = auth.uid()", async () => {
    // Intento de suplantación: el cliente manda otro applicant_id.
    const state = await applyToOpportunityAction(
      { status: "idle" },
      formWith({
        opportunity_id: OPPORTUNITY_ID,
        message: "  Me interesa porque encajo con el proyecto.  ",
        applicant_id: "00000000-0000-4000-8000-000000000099",
      }),
    );

    expect(state.status).toBe("success");
    const payload = spy.calls.find((call) => call.method === "insert")?.args[0] as Record<
      string,
      unknown
    >;
    expect(payload.applicant_id).toBe(ME);
    expect(payload.opportunity_id).toBe(OPPORTUNITY_ID);
    expect(payload.message).toBe("Me interesa porque encajo con el proyecto.");
  });

  it("mensaje con solo espacios se envía como null (opcional)", async () => {
    await applyToOpportunityAction(
      { status: "idle" },
      formWith({ opportunity_id: OPPORTUNITY_ID, message: "   " }),
    );

    const payload = spy.calls.find((call) => call.method === "insert")?.args[0] as Record<
      string,
      unknown
    >;
    expect(payload.message).toBeNull();
  });

  it("opportunity_id inválido no llega a la BD", async () => {
    const state = await applyToOpportunityAction(
      { status: "idle" },
      formWith({ opportunity_id: "no-es-un-uuid" }),
    );

    expect(state.status).toBe("error");
    expect(spy.calls.find((call) => call.method === "insert")).toBeUndefined();
  });

  it("duplicado (23505) responde alreadyApplied, no un error técnico", async () => {
    spy = createSupabaseSpy({ error: { code: "23505" } });
    requireUserMock.mockResolvedValue({
      supabase: spy.supabase as never,
      user: { id: ME },
    });

    const state = await applyToOpportunityAction(
      { status: "idle" },
      formWith({ opportunity_id: OPPORTUNITY_ID }),
    );

    expect(state.status).toBe("error");
    expect((state.message as string).endsWith("alreadyApplied")).toBe(true);
  });

  it("withdraw filtra por id y por applicant propio", async () => {
    await withdrawApplicationAction(formWith({ application_id: APPLICATION_ID }));

    const update = spy.calls.find((call) => call.method === "update")?.args[0];
    expect(update).toEqual({ status: "withdrawn" });
    expect(spy.calls.find((call) => call.method === "eq")?.args).toEqual([
      "id",
      APPLICATION_ID,
    ]);
    expect(spy.calls.filter((call) => call.method === "eq").at(-1)?.args).toEqual([
      "applicant_id",
      ME,
    ]);
  });

  it("markViewed actualiza solo el status (manager lo fija la RLS)", async () => {
    await markApplicationViewedAction(formWith({ application_id: APPLICATION_ID }));

    expect(spy.calls.find((call) => call.method === "update")?.args[0]).toEqual({
      status: "viewed",
    });
    expect(spy.calls.find((call) => call.method === "select")?.args[0]).toEqual("id");
  });

  it("accept y reject usan la transición permitida", async () => {
    await acceptApplicationAction(formWith({ application_id: APPLICATION_ID }));
    expect(spy.calls.find((call) => call.method === "update")?.args[0]).toEqual({
      status: "accepted",
    });

    await rejectApplicationAction(formWith({ application_id: APPLICATION_ID }));
    expect(spy.calls.at(-3)?.method === "update").toBe(true);
    const lastUpdate = [...spy.calls].reverse().find((call) => call.method === "update");
    expect(lastUpdate?.args[0]).toEqual({ status: "rejected" });
  });

  it("application_id inválido no dispara ninguna consulta", async () => {
    await markApplicationViewedAction(formWith({ application_id: "xyz" }));

    expect(spy.calls).toHaveLength(0);
  });
});
