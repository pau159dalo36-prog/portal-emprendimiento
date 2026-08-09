import { FLUSH_WATCH_DELTA_SECONDS } from "@/analytics/config";
import { createPlayerTracker, type PlayerTracker } from "@/analytics/player-tracker";

export type AnalyticsReport = {
  watchDelta: number;
  progress: number;
};

export type VideoAnalyticsReporter = {
  onPlay(): void;
  onPause(): void;
  onTimeUpdate(currentTime: number): void;
  onSeek(): void;
  onEnded(): void;
  setProgress(progress: number): void;
  flush(): Promise<void>;
};

export type CreateVideoAnalyticsReporterOptions = {
  videoId: string;
  anonymousSessionId: string | null;
  report: (report: AnalyticsReport) => Promise<unknown>;
  flushDeltaSeconds?: number;
};

// Lógica pura del seguimiento del player, independiente de React/Supabase (así
// se puede testear sin DOM). Envía un reporte a lo sumo cada `flushDeltaSeconds`
// de reproducción REAL acumulada y en cada pausa/seek/ended/desmontaje. El
// delta enviado vacía el acumulado del tracker, de modo que el servidor
// (`report_video_view`) recibe segundos reales y nunca se envían duplicados.
// Fail-closed: si `report` falla o el delta es 0, no se rompe nada.
export function createVideoAnalyticsReporter(
  options: CreateVideoAnalyticsReporterOptions,
): VideoAnalyticsReporter {
  const tracker: PlayerTracker = createPlayerTracker();
  const flushDeltaSeconds = options.flushDeltaSeconds ?? FLUSH_WATCH_DELTA_SECONDS;
  let progress = 0;

  function flush(): Promise<void> {
    const watchDelta = tracker.getWatchSeconds();
    if (watchDelta <= 0) {
      return Promise.resolve();
    }
    tracker.reset();
    return options
      .report({ watchDelta, progress })
      .then(() => undefined)
      .catch(() => undefined);
  }

  return {
    onPlay() {
      tracker.onPlay();
    },
    onPause() {
      tracker.onPause();
      void flush();
    },
    onTimeUpdate(currentTime) {
      tracker.onTimeUpdate(currentTime);
      if (tracker.getWatchSeconds() >= flushDeltaSeconds) {
        void flush();
      }
    },
    onSeek() {
      void flush();
    },
    onEnded() {
      progress = 1;
      tracker.onPause();
      void flush();
    },
    setProgress(nextProgress) {
      progress = Math.min(1, Math.max(0, nextProgress));
    },
    flush,
  };
}
