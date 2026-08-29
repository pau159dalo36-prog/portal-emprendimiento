import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Clave de rate-limit para llamadas sin sesión: el IP de origen (de los
// headers de proxy) o un marcador anónimo genérico. Nunca se usa como clave
// si el usuario está autenticado (mejor su id).
export async function getAnonymousRateLimitKey(): Promise<string> {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? `ip:${ip}` : "anon";
}

// Consume una unidad del límite scope/scope_key vía la RPC SECURITY DEFINER.
// Devuelve true si la llamada queda dentro del máximo, false si se supera.
export async function consumeRateLimit(
  supabase: SupabaseClient<Database>,
  scope: string,
  scopeKey: string,
  max: number,
  windowSeconds = 60,
): Promise<boolean> {
  const { data } = await supabase.rpc("consume_rate_limit", {
    p_scope: scope,
    p_scope_key: scopeKey,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  return data === true;
}