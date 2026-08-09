import { describe, expect, it, vi } from "vitest";

import { FLUSH_WATCH_DELTA_SECONDS } from "@/analytics/config";
import { createVideoAnalyticsReporter } from "@/analytics/reporter";

const UUID_V1 = "00000000-0000-4000-8000-000000000001";

function playSeconds(reporter: { onTimeUpdate(currentTime: number): void }, ...seconds: number[]) {
  reporter.onTimeUpdate(0);
  for (const second of seconds) {
    reporter.onTimeUpdate(second);
  }
}

describe("createVideoAnalyticsReporter", () => {
  it("envía cuando la reproducción REAL acumulada alcanza el umbral y vacía el acumulado", async () => {
    const report = vi.fn().mockResolvedValue(null);
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    reporter.setProgress(0.5);
    reporter.onPlay();
    playSeconds(reporter, 1, 2, 3, 4, 5);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({ watchDelta: FLUSH_WATCH_DELTA_SECONDS, progress: 0.5 });

    reporter.onTimeUpdate(6);

    expect(report).toHaveBeenCalledTimes(1);
  });

  it("no envía antes del umbral y vacía el delta en el envío", () => {
    const report = vi.fn().mockResolvedValue(null);
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    reporter.onPlay();
    playSeconds(reporter, 1, 2, 3);

    expect(report).not.toHaveBeenCalled();
  });

  it("flush en pausa envía el acumulado pendiente", async () => {
    const report = vi.fn().mockResolvedValue(null);
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    reporter.onPlay();
    playSeconds(reporter, 1, 2);
    reporter.onPause();

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({ watchDelta: 2, progress: 0 });
  });

  it("flush en seek envía el acumulado con el progreso actual", () => {
    const report = vi.fn().mockResolvedValue(null);
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    reporter.onPlay();
    playSeconds(reporter, 1, 2);
    reporter.setProgress(0.4);
    reporter.onSeek();

    expect(report).toHaveBeenCalledWith({ watchDelta: 2, progress: 0.4 });
  });

  it("ended fija el progreso a 1 y envía el acumulado", () => {
    const report = vi.fn().mockResolvedValue(null);
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    reporter.onPlay();
    playSeconds(reporter, 1, 2);
    reporter.onEnded();

    expect(report).toHaveBeenCalledWith({ watchDelta: 2, progress: 1 });
  });

  it("setProgress acota el progreso al rango [0, 1]", async () => {
    const report = vi.fn().mockResolvedValue(null);
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    reporter.setProgress(2.5);
    reporter.setProgress(-1);
    reporter.onPlay();
    playSeconds(reporter, 1);

    await reporter.flush();

    expect(report).toHaveBeenCalledWith({ watchDelta: 1, progress: 0 });
  });

  it("no envía nada si no hay watch acumulado", async () => {
    const report = vi.fn().mockResolvedValue(null);
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    await reporter.flush();
    reporter.onPause();

    expect(report).not.toHaveBeenCalled();
  });

  it("envía checkpoints espaciados durante TODO el vídeo (no solo el primer tramo)", async () => {
    const report = vi.fn().mockResolvedValue(null);
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    reporter.setProgress(0.2);
    reporter.onPlay();
    reporter.onTimeUpdate(0);
    for (let t = 1; t <= 10; t += 1) reporter.onTimeUpdate(t);

    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenNthCalledWith(1, { watchDelta: 5, progress: 0.2 });
    expect(report).toHaveBeenNthCalledWith(2, { watchDelta: 5, progress: 0.2 });
  });

  it("los timeupdate repetidos del mismo instante no inflan ni generan envíos", () => {
    const report = vi.fn().mockResolvedValue(null);
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    reporter.onPlay();
    reporter.onTimeUpdate(0);
    for (let i = 0; i < 50; i += 1) reporter.onTimeUpdate(1);
    reporter.onTimeUpdate(1.5);

    expect(report).not.toHaveBeenCalled();
  });

  it("fail-closed: un fallo de la capa de datos no hace fallar el flush", async () => {
    const report = vi.fn().mockRejectedValue(new Error("network"));
    const reporter = createVideoAnalyticsReporter({
      videoId: UUID_V1,
      anonymousSessionId: null,
      report,
    });

    reporter.onPlay();
    playSeconds(reporter, 1, 2);

    await expect(reporter.flush()).resolves.toBeUndefined();
  });
});
