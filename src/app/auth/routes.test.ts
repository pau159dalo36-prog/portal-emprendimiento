// Tests de las rutas de auth: /auth/reset-password y /auth/callback.
// No se envían correos reales: se simula el intercambio de código PKCE y el OTP.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET as resetPasswordGET } from "@/app/auth/reset-password/route";
import { GET as callbackGET } from "@/app/auth/callback/route";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginDestination } from "@/profiles/destination";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/profiles/destination", () => ({
  getPostLoginDestination: vi.fn(async () => "/onboarding"),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetPostLoginDestination = vi.mocked(getPostLoginDestination);

let exchangeCodeForSession: ReturnType<typeof vi.fn>;
let verifyOtp: ReturnType<typeof vi.fn>;

function setupSupabase() {
  exchangeCodeForSession = vi.fn().mockResolvedValue({
    data: { session: { access_token: "x" } },
    error: null,
  });
  verifyOtp = vi.fn().mockResolvedValue({ error: null });
  mockedCreateClient.mockReturnValue({
    auth: { exchangeCodeForSession, verifyOtp },
  } as never);
}

function makeRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe("GET /auth/reset-password", () => {
  beforeEach(() => setupSupabase());
  afterEach(() => vi.restoreAllMocks());

  it("un code PKCE válido intercambia y redirige a actualizar-contrasena", async () => {
    const res = await resetPasswordGET(makeRequest("https://site.com/auth/reset-password?code=abc123"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/actualizar-contrasena");
  });

  it("code inválido redirige a recuperar-contrasena con error=expired (NO loop)", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid code" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await resetPasswordGET(makeRequest("https://site.com/auth/reset-password?code=bad"));

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/recuperar-contrasena");
    expect(location).toContain("error=expired");
    errorSpy.mockRestore();
  });

  it("flujo OTP (token_hash + type=recovery) verifica y redirige a actualizar-contrasena", async () => {
    const res = await resetPasswordGET(
      makeRequest("https://site.com/auth/reset-password?token_hash=hash&type=recovery"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "hash" });
    const location = res.headers.get("location");
    expect(location).toContain("/actualizar-contrasena");
  });

  it("sin parámetros redirige a recuperar-contrasena con error=expired", async () => {
    const res = await resetPasswordGET(makeRequest("https://site.com/auth/reset-password"));

    expect(res.headers.get("location")).toContain("/recuperar-contrasena");
    expect(res.headers.get("location")).toContain("error=expired");
  });
});

describe("GET /auth/callback", () => {
  beforeEach(() => {
    setupSupabase();
    mockedGetPostLoginDestination.mockResolvedValue("/onboarding");
  });
  afterEach(() => vi.restoreAllMocks());

  it("code de confirmación válido redirige al destino post-login", async () => {
    const res = await callbackGET(makeRequest("https://site.com/auth/callback?code=abc"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toContain("/onboarding");
  });

  it("code inválido redirige a iniciar-sesion con error", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await callbackGET(makeRequest("https://site.com/auth/callback?code=bad"));

    expect(res.headers.get("location")).toContain("/iniciar-sesion");
    expect(res.headers.get("location")).toContain("error=1");
    errorSpy.mockRestore();
  });

  it("OTP type=signup redirige al destino post-login", async () => {
    const res = await callbackGET(
      makeRequest("https://site.com/auth/callback?token_hash=h&type=signup"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "h" });
    expect(res.headers.get("location")).toContain("/onboarding");
  });

  it("OTP type=recovery redirige a actualizar-contrasena", async () => {
    const res = await callbackGET(
      makeRequest("https://site.com/auth/callback?token_hash=h&type=recovery"),
    );

    expect(res.headers.get("location")).toContain("/actualizar-contrasena");
  });
});
