import { z } from "zod";
import {
  ANONYMOUS_SESSION_STORAGE_KEY,
  ANONYMOUS_SESSION_TTL_MS,
} from "@/analytics/config";
import { anonymousSessionIdSchema } from "@/analytics/schemas";

// Token anónimo de 128 bits (16 bytes → 32 chars hex), dentro del alfabeto
// [A-Za-z0-9-] que exige la base de datos. No deriva de IP ni de fingerprint.
function generateAnonymousSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const storedSessionSchema = z.object({
  id: anonymousSessionIdSchema,
  createdAt: z.number(),
});

// Devuelve el token de sesión anónima actual, regenerándolo si falta o caducó
// (TTL 30 días). Nunca lanza: si localStorage no está disponible o está
// corrupto, devuelve null (fail-closed; el player no debe romperse).
export function getAnonymousSessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ANONYMOUS_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = storedSessionSchema.safeParse(JSON.parse(raw));
      if (parsed.success && Date.now() - parsed.data.createdAt < ANONYMOUS_SESSION_TTL_MS) {
        return parsed.data.id;
      }
    }

    const id = generateAnonymousSessionId();
    window.localStorage.setItem(
      ANONYMOUS_SESSION_STORAGE_KEY,
      JSON.stringify({ id, createdAt: Date.now() }),
    );
    return id;
  } catch {
    return null;
  }
}

export { generateAnonymousSessionId };
