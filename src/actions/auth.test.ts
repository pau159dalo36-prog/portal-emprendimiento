// Tests de requestPasswordResetAction: el mensaje genérico se mantiene tanto
// en éxito como cuando Supabase devuelve error (no se revela si la cuenta
// existe), el error sí se registra server-side (solo code/status/message) y
// nunca se filtran datos sensibles (correo, tokens, claves, secretos).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthApiError } from "@supabase/supabase-js";
import { requestPasswordResetAction } from "@/actions/auth";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

vi.mock("next-intl/server", () => ({
  getLocale: () => "es",
  getTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  getPathname: () => "/",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getSiteUrl: vi.fn(() => "http://localhost:3000"),
}));

vi.mock("@/lib/rate-limit", () => ({
  // El rate-limit por IP no aplica en tests unitarios: siempre dentro del límite.
  consumeRateLimit: vi.fn(async () => true),
  getAnonymousRateLimitKey: vi.fn(async () => "test-ip"),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetSiteUrl = vi.mocked(getSiteUrl);

const GENERIC_MESSAGE = "actions.auth.resetSent";

let resetPasswordForEmail: ReturnType<typeof vi.fn>;

function setupSupabase(error?: unknown) {
  resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: error ?? null });
  mockedCreateClient.mockReturnValue({
    auth: { resetPasswordForEmail },
  } as never);
}

function formWithEmail(email: string): FormData {
  const form = new FormData();
  form.set("correo", email);
  return form;
}

describe("requestPasswordResetAction", () => {
  beforeEach(() => {
    setupSupabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reset exitoso mantiene el mensaje genérico y no loguea errores", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await requestPasswordResetAction({ status: "idle" }, formWithEmail("USUARIO@Example.com"));

    expect(result).toEqual({ status: "success", message: GENERIC_MESSAGE });
    expect(mockedGetSiteUrl).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("envía el correo normalizado y el redirectTo al servicio de Supabase", async () => {
    await requestPasswordResetAction({ status: "idle" }, formWithEmail("Usuario@Test.COM"));

    expect(resetPasswordForEmail).toHaveBeenCalledWith("usuario@test.com", {
      redirectTo: "http://localhost:3000/auth/reset-password",
    });
  });

  it("error de Supabase mantiene el mensaje genérico para el usuario", async () => {
    setupSupabase(
      new AuthApiError("Error sending recovery email", 400, "email_provider_disabled"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await requestPasswordResetAction(
      { status: "idle" },
      formWithEmail("usuario@example.com"),
    );

    expect(result).toEqual({ status: "success", message: GENERIC_MESSAGE });
    expect(result.message).toBe(GENERIC_MESSAGE);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("el error sí se registra server-side con code, status y message", async () => {
    setupSupabase(
      new AuthApiError("Rate limit reached for email", 429, "over_email_send_rate_limit"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await requestPasswordResetAction({ status: "idle" }, formWithEmail("usuario@example.com"));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [tag, payload] = errorSpy.mock.calls[0] as [string, string];
    expect(tag).toBe("[auth:error]");
    expect(JSON.parse(payload)).toEqual({
      action: "requestPasswordReset",
      name: "AuthApiError",
      code: "over_email_send_rate_limit",
      status: 429,
      message: "Rate limit reached for email",
    });
  });

  it("nunca se filtran datos sensibles en el log", async () => {
    setupSupabase(
      new AuthApiError("Service temporarily unavailable", 503, "over_request_rate_limit"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await requestPasswordResetAction(
      { status: "idle" },
      formWithEmail("Usuario.Sensible@Example.com"),
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, payload] = errorSpy.mock.calls[0] as [string, string];
    const parsed = JSON.parse(payload) as Record<string, unknown>;

    expect(Object.keys(parsed).sort()).toEqual(["action", "code", "message", "name", "status"]);
    const lower = payload.toLowerCase();
    expect(lower).not.toContain("usuario.sensible@example.com");
    expect(lower).not.toContain("usuario.sensible");
    expect(lower).not.toContain("secret");
    expect(lower).not.toContain("api_key");
    expect(lower).not.toContain("service_role");
  });
});
