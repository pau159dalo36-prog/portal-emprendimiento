/** Constantes espejo de los CHECKs SQL de FASE 10 (messages.body). */
export const MESSAGE_BODY_MIN_LENGTH = 1;
export const MESSAGE_BODY_MAX_LENGTH = 2000;

/** Anti-spam MVP (server-side, sin fingerprinting): máximo de mensajes por
 * minuto y usuario antes de responder FLOOD. Consulta indexada barata. */
export const SEND_RATE_LIMIT_PER_MINUTE = 20;
export const SEND_RATE_WINDOW_MS = 60_000;
