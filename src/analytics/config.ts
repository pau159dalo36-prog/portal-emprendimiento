// Constantes de analytics: espejo cliente de los umbrales y límites definidos en
// la migración `20260812000000_fase4_3_analytics.sql`. Los umbrales reales viven
// en la base de datos (`report_video_view`); estas constantes sirven para que el
// cliente envíe datos coherentes y para los tests.

// Sesión anónima: token efímero de 30 días (privacy-first, sin fingerprint).
export const ANONYMOUS_SESSION_STORAGE_KEY = "portal.analytics.anonymous_session";
export const ANONYMOUS_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Anti-inflado: espejo cliente de la fórmula de `report_video_view` (la BD la
// impone de nuevo; el cliente solo envía datos coherentes). El player no expone
// velocidades > 1x (no hay control de playbackRate), así que MAX_PLAYBACK_RATE
// = 1 y una petición nunca envía más de MAX_WATCH_DELTA_PER_REPORT s (máximo
// por checkpoint, el servidor lo acota con la MISMA fórmula).
export const MAX_PLAYBACK_RATE = 1;
export const SMALL_GRACE_SECONDS = 2.5;
export const MAX_WATCH_DELTA_PER_REPORT = 60;

// El player envía un reporte como mucho cada esta cantidad de segundos REALES
// reproducidos (throttle). El tracker acumula y el envío vacía el acumulado.
export const FLUSH_WATCH_DELTA_SECONDS = 5;

// Qualified view: >= 3 s reproducidos (o, para vídeos <= 10 s, progreso >= 50 %
// con >= 2 s reproducidos).
export const QUALIFIED_WATCH_SECONDS = 3;
export const SHORT_VIDEO_DURATION_SECONDS = 10;
export const SHORT_VIDEO_PROGRESS_THRESHOLD = 0.5;
export const SHORT_VIDEO_WATCH_SECONDS = 2;

// Completion: max_progress >= 0.95 y watch >= min(5 s, 50 % de la duración).
export const COMPLETION_PROGRESS_THRESHOLD = 0.95;
export const COMPLETION_MIN_WATCH_SECONDS = 5;
export const COMPLETION_WATCH_FRACTION = 0.5;

// El tracker ignora seeks: un salto de `currentTime` mayor que este umbral no
// cuenta como watch time real.
export const PLAYER_SEEK_THRESHOLD_SECONDS = 2;
