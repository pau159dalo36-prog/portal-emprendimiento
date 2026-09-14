// El OTP de recuperación se consume en el EDGE (middleware) cuando una petición
// llega a /auth/reset-password con token_hash + type=recovery. El redirect es
// relativo al mismo host (sin salto a otro dominio de Netlify), la sesión viaja
// con esa respuesta y la URL de destino queda limpia.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { updateSession } from "@/lib/supabase/proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockedCreateServerClient = vi.mocked(createServerClient);

type SetCookiePair = { name: string; value: string; options?: Record<string, unknown> };
type SetAll = (cookiesToSet: SetCookiePair[]) => void;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
});

let setAll: SetAll;
let verifyOtp: ReturnType<typeof vi.fn>;

beforeEach(() => {
  verifyOtp = vi.fn().mockImplementation(async () => {
    setAll([{ name: "sb-test-token", value: "tok123", options: { path: "/" } }]);
    return {
      data: { user: { id: "u1" }, session: { access_token: "jwt" } },
      error: null,
    };
  });
  mockedCreateServerClient.mockImplementation((_url, _key, options) => {
    const baseOptions = options as {
      cookies: { getAll(): unknown[]; setAll(cookiesToSet: SetCookiePair[]): void };
    };
    setAll = baseOptions.cookies.setAll;
    return {
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { session: null, claims: null }, error: null }),
        verifyOtp,
      },
    } as never;
  });
});

afterEach(() => vi.restoreAllMocks());

describe("updateSession · consumo de recovery en el edge", () => {
  it("token_hash+type=recovery: verifyOtp se ejecuta y el redirect va a /actualizar-contrasena SIN query", async () => {
    const res: NextResponse = await updateSession(
      new NextRequest("https://site.com/auth/reset-password?token_hash=hash&type=recovery"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "hash" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://site.com/actualizar-contrasena");
  });

  it("las Set-Cookie de la sesión viajan en la respuesta redirect del edge", async () => {
    const res: NextResponse = await updateSession(
      new NextRequest("https://site.com/auth/reset-password?token_hash=hash&type=recovery"),
    );

    expect(res.headers.get("set-cookie")).toContain("sb-test-token=tok123");
  });

  it("otp expirado en el edge: redirect limpio a ?error=expired", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { name: "AuthApiError", code: "otp_expired", status: 422, message: "Token has expired" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res: NextResponse = await updateSession(
      new NextRequest("https://site.com/auth/reset-password?token_hash=h&type=recovery"),
    );

    expect(res.headers.get("location")).toBe(
      "https://site.com/actualizar-contrasena?error=expired",
    );
    errorSpy.mockRestore();
  });

  it("no consume nada fuera de /auth/reset-password", async () => {
    const res: NextResponse = await updateSession(
      new NextRequest("https://site.com/actualizar-contrasena?token_hash=h&type=recovery"),
      NextResponse.next(),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("/auth/reset-password SIN token_hash/type no consume (lo resuelve la ruta como respaldo)", async () => {
    const res: NextResponse = await updateSession(
      new NextRequest("https://site.com/auth/reset-password"),
      NextResponse.next(),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});