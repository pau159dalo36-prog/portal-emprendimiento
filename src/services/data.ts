import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

// Fila enriquecida con el perfil del proveedor (detalle público y tarjetas).
export type ServiceWithProvider = ServiceRow & {
  provider: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    headline: string | null;
  } | null;
};

// Detalle de un servicio por id. La RLS decide la visibilidad (público
// distribuible, propio, registered_users o admin); aquí no se replica.
export async function getServiceById(
  supabase: SupabaseClient<Database>,
  serviceId: string,
): Promise<ServiceWithProvider | null> {
  const { data } = await supabase
    .from("services")
    .select(
      "*, provider:profiles!services_provider_id_fkey(id, username, full_name, avatar_url, headline)",
    )
    .eq("id", serviceId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    ...data,
    // PostgREST anida la relación N:1 como objeto, no como array.
    provider:
      data.provider && !Array.isArray(data.provider) ? data.provider : null,
  };
}

// Servicios propios para /panel/servicios (todos los estados del ciclo).
export async function listOwnServices(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ServiceRow[]> {
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("provider_id", userId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

// Servicios publicados y distribuibles de un proveedor (perfil público). La
// RLS filtra moderación/visibilidad; el orden es recencia de publicación.
export async function listPublishedServicesByProvider(
  supabase: SupabaseClient<Database>,
  providerId: string,
  limit = 12,
): Promise<ServiceRow[]> {
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("provider_id", providerId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  // Sin filtrar en cliente por status/moderación: la RLS ya oculta lo no
  // distribuible; si una fila llegara aquí es visible públicamente.
  return data ?? [];
}

// Ids guardados por el usuario para marcar estado inicial de los botones.
export async function listSavedServiceIds(
  supabase: SupabaseClient<Database>,
  userId: string,
  serviceIds: string[],
): Promise<Set<string>> {
  if (serviceIds.length === 0) {
    return new Set();
  }
  const { data } = await supabase
    .from("saved_services")
    .select("service_id")
    .eq("profile_id", userId)
    .in("service_id", serviceIds);
  return new Set((data ?? []).map((row) => row.service_id));
}
