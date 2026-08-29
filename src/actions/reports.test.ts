// Tests de submitReportAction y resolveReportAction: validación de entrada,
// rate-limit, RLS del lado cliente (reporter propio) y gate de admin para
// resolver, sin llegar nunca a la BD fuera de las llamadas esperadas.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { submitReportAction, resolveReportAction } from "@/actions/reports";
import { consumeRateLimit } from "@/lib/rate-limit";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: vi.fn(async () => true),
}));

const requireUserMock = vi.fn();
const getCurrentUserMock = vi.fn();
vi.mock("@/auth/session", () => ({
  requireUser: () => requireUserMock(),
  getCurrentUser: () => getCurrentUserMock(),
}));

const ME = "00000000-0000-4000-8000-0000000000aa";
const TARGET = "00000000-0000-4000-8000-000000000001";

function formWith(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

function mockSupabase() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ insert });
  const getClaims = vi.fn().mockResolvedValue({
    data: { claims: { app_metadata: {} } },
  });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  return { supabase: { from, auth: { getClaims }, rpc } as never, insert, from, getClaims, rpc };
}

describe("submitReportAction", () => {
  beforeEach(() => {
    requireUserMock.mockResolvedValue({ supabase: {} as never, user: { id: ME } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("publica un reporte válido con el reporter y los datos del formulario", async () => {
    const { supabase, insert } = mockSupabase();
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await submitReportAction(
      { status: "idle" },
      formWith({
        target_type: "post",
        target_id: TARGET,
        reason: "spam",
        note: "Cuenta sospechosa",
      }),
    );

    expect(state.status).toBe("success");
    expect(insert).toHaveBeenCalledWith({
      reporter_id: ME,
      target_type: "post",
      target_id: TARGET,
      reason: "spam",
      note: "Cuenta sospechosa",
    });
  });

  it("rechaza una razón no contemplada sin tocar la BD", async () => {
    const { supabase, insert } = mockSupabase();
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await submitReportAction(
      { status: "idle" },
      formWith({ target_type: "post", target_id: TARGET, reason: "poco_serio" }),
    );

    expect(state.status).toBe("error");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rechaza un target fuera de la lista sin tocar la BD", async () => {
    const { supabase, insert } = mockSupabase();
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await submitReportAction(
      { status: "idle" },
      formWith({ target_type: "parche", target_id: TARGET, reason: "spam" }),
    );

    expect(state.status).toBe("error");
    expect(insert).not.toHaveBeenCalled();
  });

  it("el rate-limit bloquea el reporte sin llegar a la BD", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValueOnce(false);
    const { supabase, insert } = mockSupabase();
    requireUserMock.mockResolvedValue({ supabase, user: { id: ME } });

    const state = await submitReportAction(
      { status: "idle" },
      formWith({ target_type: "post", target_id: TARGET, reason: "spam" }),
    );

    expect(state.status).toBe("error");
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("resolveReportAction", () => {
  const REPORT_ID = "00000000-0000-4000-8000-0000000000bb";

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("anon no puede resolver: requiere sesión", async () => {
    getCurrentUserMock.mockResolvedValue({ supabase: {} as never, user: null });

    const state = await resolveReportAction(
      { status: "idle" },
      formWith({ report_id: REPORT_ID, status: "resolved" }),
    );

    expect(state.status).toBe("error");
  });

  it("un usuario normal no puede resolver", async () => {
    getCurrentUserMock.mockResolvedValue({
      supabase: { auth: { getClaims: async () => ({ data: { claims: { app_metadata: {} } } }) } } as never,
      user: { id: ME },
    });

    const state = await resolveReportAction(
      { status: "idle" },
      formWith({ report_id: REPORT_ID, status: "resolved" }),
    );

    expect(state.status).toBe("error");
  });

  it("un admin resuelve vía RPC con la nota", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    getCurrentUserMock.mockResolvedValue({
      supabase: {
        auth: {
          getClaims: async () => ({
            data: { claims: { app_metadata: { role: "admin" } } },
          }),
        },
        rpc,
      } as never,
      user: { id: ME },
    });

    const state = await resolveReportAction(
      { status: "idle" },
      formWith({
        report_id: REPORT_ID,
        status: "resolved",
        resolution_note: "Retirado por spam",
      }),
    );

    expect(state.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("admin_resolve_report", {
      p_report_id: REPORT_ID,
      p_status: "resolved",
      p_resolution_note: "Retirado por spam",
    });
  });
});