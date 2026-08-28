// Tests de las acciones de servicios (FASE 7): ciclo de vida, autoría y
// pricing. Se mockea la sesión y se usa un stub encadenable de PostgREST con
// colas de respuesta por tabla (mismo patrón que messaging/applications).
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeServiceStatusAction,
  saveServiceAction,
} from "@/actions/service";

const ME = "00000000-0000-4000-8000-0000000000aa";
const SERVICE_ID = "00000000-0000-4000-8000-0000000000c1";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
  getLocale: async () => "es",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const requireUserMock = vi.fn();
vi.mock("@/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

import { revalidatePath } from "next/cache";

type Handler = { data?: unknown; error?: unknown };

function createSupabaseStub(queue: Record<string, Handler[]>) {
  const calls: { method: string; args: unknown[]; table?: string }[] = [];

  function builderFor(table: string) {
    const builder: Record<string, unknown> = {};
    const track =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ method, args, table });
        return builder;
      };
    for (const method of ["select", "eq", "neq", "in", "is", "order", "limit", "update", "insert"]) {
      builder[method] = track(method);
    }
    builder.maybeSingle = track("maybeSingle");
    builder.single = track("single");
    builder.then = (res: (v: unknown) => unknown) => {
      const handler = queue[table]?.shift() ?? { data: null };
      return Promise.resolve(res({ ...handler }));
    };
    return builder;
  }

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", args: [table], table });
      return builderFor(table);
    },
  };

  return { supabase: supabase as never, calls };
}

function formWith(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

const VALID_PAYLOAD = {
  title: "Desarrollo de landing pages",
  description: "Creo landing pages rápidas y accesibles para validar tu idea.",
  category: "desarrollo_web",
  delivery_mode: "remote",
  pricing_type: "fixed",
  price_amount: "500",
  price_min: "",
  price_max: "",
  currency: "EUR",
  visibility: "public",
};

describe("saveServiceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza un intent desconocido sin tocar la BD", async () => {
    const { supabase, calls } = createSupabaseStub({});
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await saveServiceAction(
      { status: "idle" },
      formWith({ intent: "delete", ...VALID_PAYLOAD }),
    );

    expect(state.status).toBe("error");
    expect(calls.filter((c) => c.method === "from")).toHaveLength(0);
  });

  it("crea un borrador propio y lo publica con intent=publish", async () => {
    const { supabase, calls } = createSupabaseStub({
      services: [{ data: null, error: null }],
    });
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await saveServiceAction(
      { status: "idle" },
      formWith({ intent: "publish", ...VALID_PAYLOAD }),
    );

    expect(state.status).toBe("success");
    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall).toBeDefined();
    expect(insertCall?.args[0]).toMatchObject({
      provider_id: ME,
      status: "published",
      pricing_type: "fixed",
      price_amount: 500,
      price_min: null,
      price_max: null,
      currency: "EUR",
    });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("guarda un draft cuando el intent es save y status=draft", async () => {
    const { supabase, calls } = createSupabaseStub({
      services: [{ data: null, error: null }],
    });
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await saveServiceAction(
      { status: "idle" },
      formWith({ intent: "save", status: "draft", ...VALID_PAYLOAD }),
    );

    expect(state.status).toBe("success");
    expect(calls.find((c) => c.method === "insert")?.args[0]).toMatchObject({ status: "draft" });
  });

  it("deniega editar un servicio ajeno: no encuentra fila propia ni actualiza", async () => {
    const { supabase, calls } = createSupabaseStub({
      // La consulta de autoría (.eq provider_id) no devuelve filas.
      services: [{ data: null }],
    });
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await saveServiceAction(
      { status: "idle" },
      formWith({ intent: "save", service_id: SERVICE_ID, ...VALID_PAYLOAD }),
    );

    expect(state.status).toBe("error");
    expect(calls.find((c) => c.method === "update")).toBeUndefined();
  });

  it("actualiza un servicio propio existente", async () => {
    const { supabase, calls } = createSupabaseStub({
      services: [{ data: { id: SERVICE_ID, status: "draft" }, error: null }],
    });
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await saveServiceAction(
      { status: "idle" },
      formWith({ intent: "save", service_id: SERVICE_ID, ...VALID_PAYLOAD }),
    );

    expect(state.status).toBe("success");
    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall).toBeDefined();
    expect(updateCall?.args[0]).toMatchObject({ title: VALID_PAYLOAD.title });
  });

  it("valida el payload: un precio fijo sin moneda falla antes de la BD", async () => {
    const { supabase, calls } = createSupabaseStub({});
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await saveServiceAction(
      { status: "idle" },
      formWith({
        intent: "publish",
        ...VALID_PAYLOAD,
        currency: "",
        title: "Título válido de servicio",
      }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.currency).toBeDefined();
    expect(calls.filter((c) => c.method === "from")).toHaveLength(0);
  });
});

describe("changeServiceStatusAction", () => {
  it.each([
    ["draft", "published", true],
    ["published", "paused", true],
    ["paused", "published", true],
    ["published", "archived", true],
    ["archived", "published", false],
    ["draft", "paused", false],
  ])("transición %s → %s aplicada=%s", async (from, to, expected) => {
    const { supabase, calls } = createSupabaseStub({
      // 1ª consulta: fila propia; 2ª: el update (solo en transiciones válidas).
      services:
        expected
          ? [{ data: { id: SERVICE_ID, status: from }, error: null }, { data: null, error: null }]
          : [{ data: null }],
    });
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    await changeServiceStatusAction(
      formWith({ service_id: SERVICE_ID, status: to }),
    );

    const updateCall = calls.find((c) => c.method === "update");
    if (expected) {
      expect(updateCall).toBeDefined();
      expect(updateCall?.args[0]).toEqual({ status: to });
    } else {
      expect(updateCall).toBeUndefined();
    }
  });

  it("ignora estados no válidos sin tocar la BD", async () => {
    const { supabase, calls } = createSupabaseStub({});
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    await changeServiceStatusAction(formWith({ service_id: SERVICE_ID, status: "deleted" }));

    expect(calls.filter((c) => c.method === "from")).toHaveLength(0);
  });

  it("ignora ids no UUID sin tocar la BD", async () => {
    const { supabase, calls } = createSupabaseStub({});
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    await changeServiceStatusAction(formWith({ service_id: "no-uuid", status: "published" }));

    expect(calls.filter((c) => c.method === "from")).toHaveLength(0);
  });
});
