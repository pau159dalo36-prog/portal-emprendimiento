// Verifica la causa raíz del bucle recuperar↔actualizar: las cookies de sesión
// que escribe Supabase (verifyOtp) deben adjuntarse a la MISMA respuesta
// redirect que devuelve /auth/reset-password. Con createRouteHandlerClient se
// enlazan al NextResponse final; si se perdieran, el navegador llegaría a
// /actualizar-contrasena sin sesión.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { GET as resetPasswordGET } from "@/app/auth/reset-password/route";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockedCreateServerClient = vi.mocked(createServerClient);

type SetCookiePair = { name: string; value: string; options?: Record<string, unknown> };
type SetAll = (cookiesToSet: SetCookiePair[]) => void;
let setAll: SetAll;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
});

beforeEach(() => {
  mockedCreateServerClient.mockImplementation((_url, _key, options) => {
    const baseOptions = options as {
      cookies: { getAll(): unknown[]; setAll(cookiesToSet: SetCookiePair[]): void };
    };
    setAll = baseOptions.cookies.setAll;
    return {
      auth: {
        verifyOtp: async () => {
          setAll([{ name: "sb-test-token", value: "tok123", options: { path: "/" } }]);
          return {
            data: { user: { id: "u1" }, session: { access_token: "jwt" } },
            error: null,
          };
        },
      },
    } as never;
  });
});

afterEach(() => vi.restoreAllMocks());

describe("GET /auth/reset-password · cookies en la respuesta redirect", () => {
  it("las Set-Cookie de verifyOtp viajan en el redirect final a /actualizar-contrasena", async () => {
    const res: NextResponse = await resetPasswordGET(
      new NextRequest("https://site.com/auth/reset-password?token_hash=hash&type=recovery"),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://site.com/actualizar-contrasena");
    expect(res.headers.get("set-cookie")).toContain("sb-test-token=tok123");
  });

  it("en error expirado, el redirect a ?error=expired mantiene las cookies de la sesión", async () => {
    mockedCreateServerClient.mockImplementation((_url, _key, options) => {
      const baseOptions = options as {
        cookies: { getAll(): unknown[]; setAll(cookiesToSet: SetCookiePair[]): void };
      };
      const localSetAll = baseOptions.cookies.setAll;
      return {
        auth: {
          verifyOtp: async () => {
            localSetAll([{ name: "sb-test-token", value: "tok456", options: { path: "/" } }]);
            return {
              data: { user: null, session: null },
              error: {
                name: "AuthApiError",
                code: "otp_expired",
                status: 422,
                message: "Token has expired",
              },
            };
          },
        },
      } as never;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res: NextResponse = await resetPasswordGET(
      new NextRequest("https://site.com/auth/reset-password?token_hash=h&type=recovery"),
    );

    expect(res.headers.get("location")).toBe(
      "https://site.com/actualizar-contrasena?error=expired",
    );
    errorSpy.mockRestore();
  });
});
