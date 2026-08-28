// Tests del data layer de servicios (FASE 7): mapeo de la fila con proveedor
// anidado, listados propios y estado de guardado.
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getServiceById,
  listOwnServices,
  listSavedServiceIds,
} from "@/services/data";

type Handler = { data?: unknown; error?: unknown };

function createSupabaseStub(queue: Record<string, Handler[]> = {}) {
  const calls: { method: string; args: unknown[]; table?: string }[] = [];

  function builderFor(table: string) {
    const builder: Record<string, unknown> = {};
    const track =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ method, args, table });
        return builder;
      };
    for (const method of ["select", "eq", "neq", "in", "is", "order", "limit"]) {
      builder[method] = track(method);
    }
    builder.maybeSingle = track("maybeSingle");
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

  return { supabase: supabase as unknown as SupabaseClient<never>, calls };
}

const ROW = {
  id: "00000000-0000-4000-8000-0000000000c1",
  provider_id: "00000000-0000-4000-8000-0000000000aa",
  title: "Desarrollo de landing pages",
  description: "Landing pages rápidas y accesibles.",
  category: "desarrollo_web",
  delivery_mode: "remote",
  pricing_type: "fixed",
  price_amount: 500,
  price_min: null,
  price_max: null,
  currency: "EUR",
  status: "published",
  visibility: "public",
  moderation_status: "unreviewed",
  published_at: "2026-08-01T10:00:00.000Z",
  created_at: "2026-08-01T09:00:00.000Z",
  updated_at: "2026-08-01T09:00:00.000Z",
};

describe("getServiceById", () => {
  let stub: ReturnType<typeof createSupabaseStub>;

  beforeEach(() => {
    stub = createSupabaseStub({});
  });

  it("devuelve null cuando no hay fila (RLS o inexistente)", async () => {
    const service = await getServiceById(stub.supabase as never, ROW.id);
    expect(service).toBeNull();
  });

  it("mapea el proveedor anidado como objeto", async () => {
    stub = createSupabaseStub({
      services: [
        {
          data: {
            ...ROW,
            provider: {
              id: ROW.provider_id,
              username: "ana",
              full_name: "Ana García",
              avatar_url: null,
              headline: "Dev freelance",
            },
          },
        },
      ],
    });

    const service = await getServiceById(stub.supabase as never, ROW.id);

    expect(service).not.toBeNull();
    expect(service?.title).toBe(ROW.title);
    expect(Array.isArray(service?.provider)).toBe(false);
    expect(service?.provider?.username).toBe("ana");
  });
});

describe("listOwnServices", () => {
  it("lista los servicios propios ordenados por updated_at desc", async () => {
    const stub = createSupabaseStub({
      services: [{ data: [ROW] }],
    });

    const services = await listOwnServices(stub.supabase as never, ROW.provider_id);

    expect(services).toHaveLength(1);
    expect(stub.calls.find((c) => c.method === "eq")?.args).toEqual([
      "provider_id",
      ROW.provider_id,
    ]);
    expect(
      stub.calls.find((c) => c.method === "order")?.args[0],
    ).toEqual("updated_at");
  });

  it("devuelve array vacío sin filas", async () => {
    const stub = createSupabaseStub({});
    const services = await listOwnServices(stub.supabase as never, ROW.provider_id);
    expect(services).toEqual([]);
  });
});

describe("listSavedServiceIds", () => {
  it("devuelve un set vacío sin ids que consultar", async () => {
    const stub = createSupabaseStub({});
    const saved = await listSavedServiceIds(stub.supabase as never, ROW.provider_id, []);
    expect(saved.size).toBe(0);
    expect(stub.calls.filter((c) => c.method === "from")).toHaveLength(0);
  });

  it("consulta saved_services para los ids dados", async () => {
    const OTHER_ID = "00000000-0000-4000-8000-0000000000c2";
    const stub = createSupabaseStub({
      saved_services: [{ data: [{ service_id: ROW.id }] }],
    });

    const saved = await listSavedServiceIds(
      stub.supabase as never,
      ROW.provider_id,
      [ROW.id, OTHER_ID],
    );

    expect(saved.has(ROW.id)).toBe(true);
    expect(saved.has(OTHER_ID)).toBe(false);
  });
});
