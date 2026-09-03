// Tests de getSiteUrl: en producción nunca se genera localhost, y la URL se
// normaliza (sin barra final, sin query/fragment).
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSiteUrl", () => {
  it("en producción usa la URL configurada y NUNCA localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://sensational-squirrel-26a2f8.netlify.app/");

    const url = getSiteUrl();

    expect(url).toBe("https://sensational-squirrel-26a2f8.netlify.app");
    expect(url).not.toContain("localhost");
    expect(url.endsWith("/")).toBe(false);
  });

  it("en producción sin NEXT_PUBLIC_SITE_URL lanza un error (no cae a localhost)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(() => getSiteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("en desarrollo sin configuración usa localhost:3000", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("normaliza la URL (sin barra final, sin query ni fragment)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ejemplo.com/beta/?x=1#frag");

    expect(getSiteUrl()).toBe("https://ejemplo.com/beta");
  });
});
