import { PLAYER_SEEK_THRESHOLD_SECONDS } from "@/analytics/config";

export type PlayerTracker = {
  onPlay(): void;
  onPause(): void;
  onTimeUpdate(currentTime: number): void;
  reset(): void;
  getWatchSeconds(): number;
  isPlaying(): boolean;
};

// Acumula los segundos REALES reproducidos del player. Ignora los seeks: un
// salto de `currentTime` hacia delante mayor que el umbral (o hacia atrás) no
// cuenta como watch time. El cliente solo reporta el acumulado a la base de
// datos (que además lo acota de nuevo en `report_video_view`).
export function createPlayerTracker(): PlayerTracker {
  let watchSeconds = 0;
  let lastTime: number | null = null;
  let playing = false;

  return {
    onPlay() {
      playing = true;
    },
    onPause() {
      playing = false;
    },
    onTimeUpdate(currentTime) {
      if (!playing || lastTime == null) {
        lastTime = currentTime;
        return;
      }
      const delta = currentTime - lastTime;
      lastTime = currentTime;
      if (delta > 0 && delta <= PLAYER_SEEK_THRESHOLD_SECONDS) {
        watchSeconds += delta;
      }
    },
    // Vacía el acumulado SIN tocar el estado de reproducción: `reset` se usa en
    // cada flush del reporter y un flush a mitad de reproducción no debe parar
    // el seguimiento del resto del vídeo (lastTime se conserva para que el
    // siguiente `timeupdate` siga acumulando sin huecos ni saltos).
    reset() {
      watchSeconds = 0;
    },
    getWatchSeconds() {
      return watchSeconds;
    },
    isPlaying() {
      return playing;
    },
  };
}
