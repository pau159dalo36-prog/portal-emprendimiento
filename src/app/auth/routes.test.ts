// Tests de las rutas de auth del flujo de recuperación de contraseña.
// Se simula el intercambio de código PKCE y la verificación OTP (token_hash);
// no se envían correos reales.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET as resetPasswordGET } from "@/app/auth/reset-password/route";
import { GET as callbackGET } from "@/app/auth/callback/route";
import { GET as confirmGET } from "@/app/auth/confirm/route";
import { createClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { getPostLoginDestination } from "@/profiles/destination";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createRouteHandlerClient: vi.fn(),
}));

vi.mock("@/profiles/destination", () => ({
  getPostLoginDestination: vi.fn(async () => "/onboarding"),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateRouteHandlerClient = vi.mocked(createRouteHandlerClient);
const mockedGetPostLoginDestination = vi.mocked(getPostLoginDestination);

let exchangeCodeForSession: ReturnType<typeof vi.fn>;
let verifyOtp: ReturnType<typeof vi.fn>;

function setupSupabase() {
  exchangeCodeForSession = vi.fn().mockResolvedValue({
    data: { session: { access_token: "x" } },
    error: null,
  });
  verifyOtp = vi.fn().mockResolvedValue({ error: null });
  const client = {
    auth: { exchangeCodeForSession, verifyOtp },
  } as never;
  mockedCreateClient.mockReturnValue(client);
  mockedCreateRouteHandlerClient.mockReturnValue(client);
}

function makeRequest(url: string): NextRequest {
  return new NextRequest(url);
}

function lastLocation(res: Response): string {
  return res.headers.get("location") ?? "";
}

describe("GET /auth/reset-password (consumidor canónico del recovery)", () => {
  beforeEach(() => setupSupabase());
  afterEach(() => vi.restoreAllMocks());

  it("token_hash + type=recovery: verifyOtp UNA sola vez y redirige a actualizar-contrasena", async () => {
    const res = await resetPasswordGET(
      makeRequest("https://site.com/auth/reset-password?token_hash=hash&type=recovery"),
    );

    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "hash" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(lastLocation(res)).toContain("/actualizar-contrasena");
  });

  it("otp_expired REAL: redirige a actualizar-contrasena?error=expired (tarjeta, sin bucle)", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { name: "AuthApiError", code: "otp_expired", status: 422, message: "Token has expired" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await resetPasswordGET(
      makeRequest("https://site.com/auth/reset-password?token_hash=h&type=recovery"),
    );

    const location = lastLocation(res);
    expect(location).toContain("/actualizar-contrasena");
    expect(location).toContain("error=expired");
    expect(location).not.toContain("error=technical");
    expect(location).not.toContain("/recuperar-contrasena");
    errorSpy.mockRestore();
  });

  it("error TÉCNICO NO se etiqueta como expired: redirige a actualizar-contrasena?error=technical", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { name: "AuthRetryableFetchError", code: "request_timeout", status: 503, message: "timeout" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await resetPasswordGET(
      makeRequest("https://site.com/auth/reset-password?token_hash=h&type=recovery"),
    );

    const location = lastLocation(res);
    expect(location).toContain("/actualizar-contrasena");
    expect(location).toContain("error=technical");
    expect(location).not.toContain("error=expired");
    expect(location).not.toContain("/recuperar-contrasena");
    errorSpy.mockRestore();
  });

  it("code PKCE válido: exchangeCodeForSession y redirige a actualizar-contrasena", async () => {
    const res = await resetPasswordGET(
      makeRequest("https://site.com/auth/reset-password?code=abc123"),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123", undefined);
    expect(lastLocation(res)).toContain("/actualizar-contrasena");
  });

  it("code PKCE con sb_flow_id: pasa el flowId al exchange", async () => {
    await resetPasswordGET(
      makeRequest(
        "https://site.com/auth/reset-password?code=abc&sb_flow_id=flowid12345678",
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc", { flowId: "flowid12345678" });
  });

  it("code PKCE con verifier ausente NO se marca como expired (error técnico)", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        name: "AuthPKCECodeVerifierMissingError",
        code: "AuthPKCECodeVerifierMissingError",
        status: 500,
        message: "PKCE code verifier not found in storage",
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await resetPasswordGET(
      makeRequest("https://site.com/auth/reset-password?code=zzz"),
    );

    const location = lastLocation(res);
    expect(location).toContain("/actualizar-contrasena");
    expect(location).toContain("error=technical");
    expect(location).not.toContain("error=expired");
    expect(location).not.toContain("/recuperar-contrasena");
    errorSpy.mockRestore();
  });

  it("sin parámetros: enlace mal formado → error TÉCNICO (no 'expired' sin credenciales)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await resetPasswordGET(makeRequest("https://site.com/auth/reset-password"));

    const location = lastLocation(res);
    expect(location).toContain("/actualizar-contrasena");
    expect(location).toContain("error=technical");
    expect(location).not.toContain("error=expired");
    expect(verifyOtp).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("GET /auth/confirm (NO consume recovery, lo reenvía)", () => {
  beforeEach(() => setupSupabase());
  afterEach(() => vi.restoreAllMocks());

  it("type=recovery: reenvía a /auth/reset-password SIN verificar (un único consumidor)", async () => {
    const res = await confirmGET(
      makeRequest("https://site.com/auth/confirm?token_hash=h&type=recovery"),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    const location = lastLocation(res);
    expect(location).toContain("/auth/reset-password");
    expect(location).toContain("token_hash=h");
    expect(location).toContain("type=recovery");
  });

  it("type=signup: verifica y redirige a onboarding", async () => {
    const res = await confirmGET(
      makeRequest("https://site.com/auth/confirm?token_hash=h&type=signup"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "h" });
    expect(lastLocation(res)).toContain("/onboarding");
  });
});

describe("GET /auth/callback (NO consume recovery, lo reenvía)", () => {
  beforeEach(() => {
    setupSupabase();
    mockedGetPostLoginDestination.mockResolvedValue("/onboarding");
  });
  afterEach(() => vi.restoreAllMocks());

  it("type=recovery: reenvía a /auth/reset-password SIN verificar", async () => {
    const res = await callbackGET(
      makeRequest("https://site.com/auth/callback?token_hash=h&type=recovery"),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    const location = lastLocation(res);
    expect(location).toContain("/auth/reset-password");
    expect(location).toContain("token_hash=h");
    expect(location).toContain("type=recovery");
  });

  it("code de confirmación válido: exchange y redirige al destino post-login", async () => {
    const res = await callbackGET(makeRequest("https://site.com/auth/callback?code=abc"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(lastLocation(res)).toContain("/onboarding");
  });

  it("OTP type=signup: verifica y redirige al destino post-login", async () => {
    const res = await callbackGET(
      makeRequest("https://site.com/auth/callback?token_hash=h&type=signup"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "h" });
    expect(lastLocation(res)).toContain("/onboarding");
  });
});
