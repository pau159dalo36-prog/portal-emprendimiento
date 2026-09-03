// Tests del clasificador de errores de recuperación: distingue un enlace
// REALMENTE caducado/usado (`expired`) de fallos técnicos/PKCE (`technical`),
// para que un fallo interno nunca se presente como "enlace expirado".
import { describe, expect, it } from "vitest";
import { classifyRecoveryError } from "./auth-recovery";

function makeError(overrides: Record<string, unknown> = {}) {
  return {
    name: "AuthApiError",
    code: undefined,
    status: undefined,
    message: "error",
    ...overrides,
  } as never;
}

describe("classifyRecoveryError", () => {
  it("token caducado (otp_expired) → expired", () => {
    expect(
      classifyRecoveryError(makeError({ code: "otp_expired", status: 422, message: "Token has expired" })),
    ).toBe("expired");
  });

  it("token usado / sesión ausente tras la verificación → expired", () => {
    expect(
      classifyRecoveryError(
        makeError({ name: "AuthInvalidTokenResponseError", status: 500, message: "Auth session or user missing" }),
      ),
    ).toBe("expired");
  });

  it("mensaje de token caducado → expired aun sin code", () => {
    expect(
      classifyRecoveryError(makeError({ name: "AuthApiError", status: 422, message: "email OTP has expired or has been already used." })),
    ).toBe("expired");
  });

  it("verifier PKCE ausente (otro navegador/dispositivo) → technical, NO expired", () => {
    expect(
      classifyRecoveryError(
        makeError({
          name: "AuthPKCECodeVerifierMissingError",
          code: "AuthPKCECodeVerifierMissingError",
          status: 500,
          message: "PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device.",
        }),
      ),
    ).toBe("technical");
  });

  it("error de red/retryable (5xx) → technical, NO expired", () => {
    expect(
      classifyRecoveryError(
        makeError({ name: "AuthRetryableFetchError", status: 503, message: "Failed to fetch" }),
      ),
    ).toBe("technical");
  });

  it("error desconocido/inesperado → technical, nunca expired", () => {
    expect(
      classifyRecoveryError(makeError({ name: "AuthApiError", status: 400, message: "some unexpected error" })),
    ).toBe("technical");
  });

  it("sin error (null) → technical (caso no debería ocurrir)", () => {
    expect(classifyRecoveryError(null)).toBe("technical");
  });
});
