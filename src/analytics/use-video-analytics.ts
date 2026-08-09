"use client";

import { useEffect, useMemo, useRef } from "react";

import { getAnonymousSessionId } from "@/analytics/anonymous-session";
import { reportVideoView } from "@/analytics/data";
import {
  createVideoAnalyticsReporter,
  type VideoAnalyticsReporter,
} from "@/analytics/reporter";
import { createClient } from "@/lib/supabase/client";

// Hook que conecta el player con la capa de analytics. Si `videoId` es
// undefined todas las operaciones son no-op (el player se sigue usando sin
// seguimiento, p. ej. para previsualizaciones). La sesión anónima se resuelve
// una vez por montaje y el reporte final se envía al desmontar (fail-closed:
// nunca lanza y nunca rompe la reproducción).
export function useVideoAnalytics(videoId: string | undefined): VideoAnalyticsReporter {
  const reporterRef = useRef<VideoAnalyticsReporter | null>(null);

  useEffect(() => {
    if (!videoId) {
      return;
    }

    const client = createClient();
    const anonymousSessionId = getAnonymousSessionId();
    const reporter = createVideoAnalyticsReporter({
      videoId,
      anonymousSessionId,
      report: ({ watchDelta, progress }) =>
        reportVideoView(client, {
          videoId,
          anonymousSessionId,
          watchDelta,
          progress,
        }),
    });
    reporterRef.current = reporter;

    return () => {
      void reporter.flush();
      reporterRef.current = null;
    };
  }, [videoId]);

  return useMemo<VideoAnalyticsReporter>(
    () => ({
      onPlay() {
        reporterRef.current?.onPlay();
      },
      onPause() {
        reporterRef.current?.onPause();
      },
      onTimeUpdate(currentTime) {
        reporterRef.current?.onTimeUpdate(currentTime);
      },
      onSeek() {
        reporterRef.current?.onSeek();
      },
      onEnded() {
        reporterRef.current?.onEnded();
      },
      setProgress(progress) {
        reporterRef.current?.setProgress(progress);
      },
      flush() {
        return reporterRef.current?.flush() ?? Promise.resolve();
      },
    }),
    [],
  );
}
