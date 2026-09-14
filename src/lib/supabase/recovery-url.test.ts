import { describe, expect, it } from "vitest";
import { cleanRecoveryPageParams } from "@/lib/supabase/recovery-url";

describe("cleanRecoveryPageParams", () => {
  it("limpia token_hash/type si quedaron en la URL de actualizar-contrasena", () => {
    const clean = cleanRecoveryPageParams(
      "https://site.com/actualizar-contrasena?token_hash=abc&type=recovery",
    );
    expect(clean).toBe("https://site.com/actualizar-contrasena");
  });

  it("limpia en versiones con prefijo de locale", () => {
    const clean = cleanRecoveryPageParams(
      "https://site.com/es/actualizar-contrasena?token_hash=abc&type=recovery&extra=1",
    );
    expect(clean).toBe("https://site.com/es/actualizar-contrasena?extra=1");
    const cleanEn = cleanRecoveryPageParams(
      "https://site.com/en/actualizar-contrasena?token_hash=abc&type=recovery",
    );
    expect(cleanEn).toBe("https://site.com/en/actualizar-contrasena");
  });

  it("limpia también code/sb_flow_id (fallback PKCE)", () => {
    const clean = cleanRecoveryPageParams(
      "https://site.com/actualizar-contrasena?code=abc&sb_flow_id=xyz",
    );
    expect(clean).toBe("https://site.com/actualizar-contrasena");
  });

  it("conserva params NO relacionados (error)", () => {
    const clean = cleanRecoveryPageParams("https://site.com/es/actualizar-contrasena?error=technical");
    expect(clean).toBeNull();
  });

  it("devuelve null para otras rutas", () => {
    expect(
      cleanRecoveryPageParams("https://site.com/recuperar-contrasena?token_hash=abc&type=recovery"),
    ).toBeNull();
    expect(cleanRecoveryPageParams("https://site.com/auth/reset-password?token_hash=abc")).toBeNull();
  });

  it("devuelve null si no hay parámetros que limpiar", () => {
    expect(cleanRecoveryPageParams("https://site.com/actualizar-contrasena")).toBeNull();
    expect(cleanRecoveryPageParams("https://site.com/es/actualizar-contrasena?error=expired")).toBeNull();
  });
});