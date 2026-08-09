import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAnonymousSessionId, generateAnonymousSessionId } from "@/analytics/anonymous-session";
import { ANONYMOUS_SESSION_STORAGE_KEY, ANONYMOUS_SESSION_TTL_MS, MAX_WATCH_DELTA_PER_REPORT } from "@/analytics/config";
import {
  getPostMetrics,
  getPublicVideoViewsCount,
  getVideoMetrics,
  reportVideoView,
} from "@/analytics/data";
import { createPlayerTracker } from "@/analytics/player-tracker";
import { anonymousSessionIdSchema } from "@/analytics/schemas";
import type { Database } from "@/types/database.types";

const UUID_V1 = "00000000-0000-4000-8000-000000000001";
const UUID_V2 = "00000000-0000-4000-8000-000000000002";
const SESSION = "a1b2c3d4e5f6a1b2c3d4e5f6";

function createQuerySpy(options: { data?: unknown; error?: unknown } = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const result = { data: options.data, error: options.error ?? null };

  const builder = {
    rpc(...args: unknown[]) {
      calls.push({ method: "rpc", args });
      return builder;
    },
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(onFulfilled(result));
    },
  };

  const supabase = {
    rpc(...args: unknown[]) {
      calls.push({ method: "rpc", args });
      return builder;
    },
  };

  return {
    supabase: supabase as unknown as SupabaseClient<Database>,
    calls,
  };
}

function rpcCall(calls: { method: string; args: unknown[] }[], name: string) {
  return calls.find((call) => call.method === "rpc" && call.args[0] === name)?.args[1];
}

describe("analytics (capa de datos)", () => {
  it("reportVideoView llama a la RPC con los parámetros correctos", async () => {
    const { supabase, calls } = createQuerySpy({
      data: [{ qualified: true, completed: false, watch_seconds: 12.5, max_progress: 0.4 }],
    });

    const result = await reportVideoView(supabase, {
      videoId: UUID_V1,
      anonymousSessionId: SESSION,
      watchDelta: 12.5,
      progress: 0.4,
    });

    expect(rpcCall(calls, "report_video_view")).toEqual({
      p_video_id: UUID_V1,
      p_anonymous_session_id: SESSION,
      p_watch_delta: 12.5,
      p_progress: 0.4,
    });
    expect(result).toEqual({
      qualified: true,
      completed: false,
      watch_seconds: 12.5,
      max_progress: 0.4,
    });
  });

  it("reportVideoView envía anonymous_session_id null y acota el delta a 60 s", async () => {
    const { supabase, calls } = createQuerySpy();

    await reportVideoView(supabase, { videoId: UUID_V1, watchDelta: 120, progress: 0 });

    const args = rpcCall(calls, "report_video_view");
    expect(args).toMatchObject({
      p_anonymous_session_id: null,
      p_watch_delta: MAX_WATCH_DELTA_PER_REPORT,
    });
  });

  it("reportVideoView devuelve null con entrada inválida sin llamar a la RPC", async () => {
    const { supabase, calls } = createQuerySpy();

    const result = await reportVideoView(supabase, {
      videoId: "no-uuid",
      watchDelta: 10,
      progress: 0.5,
    });

    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("analytics fallido no rompe el player: ante error devuelve null en vez de lanzar", async () => {
    const tracker = createPlayerTracker();
    const failing = createQuerySpy({ error: new Error("network") });

    tracker.onPlay();
    tracker.onTimeUpdate(0);
    tracker.onTimeUpdate(3);

    const first = await reportVideoView(failing.supabase, {
      videoId: UUID_V1,
      watchDelta: tracker.getWatchSeconds(),
      progress: 0.5,
    });
    expect(first).toBeNull();

    tracker.onTimeUpdate(4);
    const working = createQuerySpy({
      data: [{ qualified: true, completed: false, watch_seconds: 4, max_progress: 0.5 }],
    });
    const second = await reportVideoView(working.supabase, {
      videoId: UUID_V1,
      watchDelta: tracker.getWatchSeconds(),
      progress: 0.5,
    });
    expect(second?.qualified).toBe(true);
    expect(second?.watch_seconds).toBe(4);
  });

  it("getVideoMetrics/getPostMetrics usan las RPC de métricas del propietario", async () => {
    const metricsData = [
      {
        qualified_views: 3,
        plays: 4,
        unique_viewers: 3,
        total_watch_seconds: 120,
        average_watch_seconds: 40,
        completion_rate: 0.5,
        average_progress: 0.7,
        last_interaction: "2026-01-01T00:00:00Z",
      },
    ];
    const { supabase, calls } = createQuerySpy({ data: metricsData });

    const videoMetrics = await getVideoMetrics(supabase, UUID_V1);
    expect(rpcCall(calls, "get_video_metrics")).toEqual({ p_video_id: UUID_V1 });
    expect(videoMetrics?.qualified_views).toBe(3);

    calls.length = 0;
    const postMetrics = await getPostMetrics(supabase, UUID_V2);
    expect(rpcCall(calls, "get_post_metrics")).toEqual({ p_post_id: UUID_V2 });
    expect(postMetrics?.unique_viewers).toBe(3);
  });

  it("getVideoMetrics devuelve null con un id no UUID sin consultar", async () => {
    const { supabase, calls } = createQuerySpy();

    expect(await getVideoMetrics(supabase, "no-uuid")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("getPublicVideoViewsCount devuelve el contador público", async () => {
    const { supabase, calls } = createQuerySpy({ data: 7 });

    expect(await getPublicVideoViewsCount(supabase, UUID_V1)).toBe(7);
    expect(rpcCall(calls, "get_public_video_views_count")).toEqual({ p_video_id: UUID_V1 });
  });

  it("getPublicVideoViewsCount devuelve null ante error", async () => {
    const { supabase } = createQuerySpy({ error: new Error("network") });

    expect(await getPublicVideoViewsCount(supabase, UUID_V1)).toBeNull();
  });

  it("anonymousSessionIdSchema valida el formato del token anónimo", () => {
    expect(anonymousSessionIdSchema.safeParse("a".repeat(16)).success).toBe(true);
    expect(anonymousSessionIdSchema.safeParse("A-Z09-".padEnd(20, "a")).success).toBe(true);
    expect(anonymousSessionIdSchema.safeParse("short").success).toBe(false);
    expect(anonymousSessionIdSchema.safeParse("a".repeat(65)).success).toBe(false);
    expect(anonymousSessionIdSchema.safeParse("token_with_underscore_and_plus!").success).toBe(false);
  });

  it("generateAnonymousSessionId genera un token de 128 bits válido", () => {
    const id = generateAnonymousSessionId();

    expect(id).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    expect(id.length).toBe(32);
  });

  it("getAnonymousSessionId persiste y reutiliza el token en localStorage", () => {
    const store = new Map<string, string>();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => store.get(key) ?? null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
      store.set(key, value);
    });

    const first = getAnonymousSessionId();
    const second = getAnonymousSessionId();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(first).toMatch(/^[A-Za-z0-9-]{16,64}$/);

    vi.restoreAllMocks();
  });

  it("getAnonymousSessionId regenera un token caducado", () => {
    const store = new Map<string, string>();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => store.get(key) ?? null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
      store.set(key, value);
    });
    store.set(
      ANONYMOUS_SESSION_STORAGE_KEY,
      JSON.stringify({ id: SESSION, createdAt: Date.now() - ANONYMOUS_SESSION_TTL_MS - 1000 }),
    );

    const regenerated = getAnonymousSessionId();

    expect(regenerated).not.toBe(SESSION);
    expect(regenerated).toMatch(/^[A-Za-z0-9-]{16,64}$/);

    vi.restoreAllMocks();
  });

  it("getAnonymousSessionId devuelve null si localStorage no está disponible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(getAnonymousSessionId()).toBeNull();

    vi.restoreAllMocks();
  });
});

describe("player-tracker", () => {
  it("acumula segundos reales reproducidos", () => {
    const tracker = createPlayerTracker();
    tracker.onPlay();
    tracker.onTimeUpdate(0);
    tracker.onTimeUpdate(1);
    tracker.onTimeUpdate(2.5);

    expect(tracker.getWatchSeconds()).toBe(2.5);
  });

  it("no acumula mientras está en pausa", () => {
    const tracker = createPlayerTracker();
    tracker.onPlay();
    tracker.onTimeUpdate(0);
    tracker.onPause();
    tracker.onTimeUpdate(10);
    tracker.onPlay();
    tracker.onTimeUpdate(10.5);

    expect(tracker.getWatchSeconds()).toBe(0.5);
  });

  it("ignora seeks hacia delante y hacia atrás", () => {
    const tracker = createPlayerTracker();
    tracker.onPlay();
    tracker.onTimeUpdate(0);
    tracker.onTimeUpdate(1);
    tracker.onTimeUpdate(30);

    expect(tracker.getWatchSeconds()).toBe(1);

    tracker.onTimeUpdate(2);

    expect(tracker.getWatchSeconds()).toBe(1);
  });

  it("reset vacía el acumulado sin detener la reproducción en curso", () => {
    const tracker = createPlayerTracker();
    tracker.onPlay();
    tracker.onTimeUpdate(0);
    tracker.onTimeUpdate(4);
    tracker.reset();

    expect(tracker.getWatchSeconds()).toBe(0);
    expect(tracker.isPlaying()).toBe(true);

    tracker.onTimeUpdate(5);
    expect(tracker.getWatchSeconds()).toBe(1);
  });

  it("reset conserva la última posición para seguir acumulando sin huecos", () => {
    const tracker = createPlayerTracker();
    tracker.onPlay();
    tracker.onTimeUpdate(0);
    tracker.onTimeUpdate(3);
    tracker.reset();
    tracker.onTimeUpdate(4);

    expect(tracker.getWatchSeconds()).toBe(1);
  });
});
