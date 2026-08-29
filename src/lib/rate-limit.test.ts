import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { headers } from "next/headers";
import { consumeRateLimit, getAnonymousRateLimitKey } from "@/lib/rate-limit";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

const headersMock = vi.mocked(headers);

describe("consumeRateLimit", () => {
  it("devuelve true cuando la RPC confirma el consumo", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true });

    const ok = await consumeRateLimit({ rpc } as never, "scope", "key", 5, 60);

    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_scope: "scope",
      p_scope_key: "key",
      p_max: 5,
      p_window_seconds: 60,
    });
  });

  it("devuelve false cuando la RPC deniega o no responde", async () => {
    const rpcFalse = vi.fn().mockResolvedValue({ data: false });
    const rpcNull = vi.fn().mockResolvedValue({ data: null });

    expect(await consumeRateLimit({ rpc: rpcFalse } as never, "s", "k", 5, 60)).toBe(false);
    expect(await consumeRateLimit({ rpc: rpcNull } as never, "s", "k", 5, 60)).toBe(false);
  });

  it("usa la ventana por defecto de 60 segundos", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true });

    await consumeRateLimit({ rpc } as never, "s", "k", 5);

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_scope: "s",
      p_scope_key: "k",
      p_max: 5,
      p_window_seconds: 60,
    });
  });
});

describe("getAnonymousRateLimitKey", () => {
  beforeEach(() => {
    headersMock.mockReset();
    headersMock.mockResolvedValue({ get: () => null } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("usa la primera IP de x-forwarded-for", async () => {
    headersMock.mockResolvedValue({ get: () => "1.2.3.4, 5.6.7.8" } as never);

    expect(await getAnonymousRateLimitKey()).toBe("ip:1.2.3.4");
  });

  it("usa un marcador genérico si no hay cabecera de IP", async () => {
    expect(await getAnonymousRateLimitKey()).toBe("anon");
  });
});