import type { SupabaseClient } from "@supabase/supabase-js";

import type { SaveTarget } from "@/config/interactions";
import type { Database } from "@/types/database.types";

import type { InteractionResult } from "@/interactions/types";

// Tablas con FK real por tipo de contenido (sin polimorfismo): la RLS de cada
// tabla valida que el destino sea públicamente visible al guardar. Cada rama
// va explícita para que Supabase tipifique tabla y columnas sin uniones.

export async function isSaved(
  supabase: SupabaseClient<Database>,
  userId: string,
  target: SaveTarget,
  itemId: string,
): Promise<boolean> {
  if (target === "post") {
    const { data } = await supabase
      .from("saved_posts")
      .select("post_id")
      .eq("profile_id", userId)
      .eq("post_id", itemId)
      .maybeSingle();
    return data !== null;
  }
  if (target === "project") {
    const { data } = await supabase
      .from("saved_projects")
      .select("project_id")
      .eq("profile_id", userId)
      .eq("project_id", itemId)
      .maybeSingle();
    return data !== null;
  }

  const { data } = await supabase
    .from("saved_opportunities")
    .select("opportunity_id")
    .eq("profile_id", userId)
    .eq("opportunity_id", itemId)
    .maybeSingle();
  return data !== null;
}

// Guardar es idempotente (upsert ignorando duplicados sobre la PK compuesta).
export async function save(
  supabase: SupabaseClient<Database>,
  userId: string,
  target: SaveTarget,
  itemId: string,
): Promise<InteractionResult> {
  if (target === "post") {
    const { error } = await supabase
      .from("saved_posts")
      .upsert(
        { profile_id: userId, post_id: itemId },
        { onConflict: "profile_id, post_id", ignoreDuplicates: true },
      );
    return { error: error ? "FAILED" : null, errorMessage: error?.message };
  }
  if (target === "project") {
    const { error } = await supabase
      .from("saved_projects")
      .upsert(
        { profile_id: userId, project_id: itemId },
        { onConflict: "profile_id, project_id", ignoreDuplicates: true },
      );
    return { error: error ? "FAILED" : null, errorMessage: error?.message };
  }

  const { error } = await supabase
    .from("saved_opportunities")
    .upsert(
      { profile_id: userId, opportunity_id: itemId },
      { onConflict: "profile_id, opportunity_id", ignoreDuplicates: true },
    );
  return { error: error ? "FAILED" : null, errorMessage: error?.message };
}

export async function unsave(
  supabase: SupabaseClient<Database>,
  userId: string,
  target: SaveTarget,
  itemId: string,
): Promise<InteractionResult> {
  if (target === "post") {
    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("profile_id", userId)
      .eq("post_id", itemId);
    return { error: error ? "FAILED" : null, errorMessage: error?.message };
  }
  if (target === "project") {
    const { error } = await supabase
      .from("saved_projects")
      .delete()
      .eq("profile_id", userId)
      .eq("project_id", itemId);
    return { error: error ? "FAILED" : null, errorMessage: error?.message };
  }

  const { error } = await supabase
    .from("saved_opportunities")
    .delete()
    .eq("profile_id", userId)
    .eq("opportunity_id", itemId);
  return { error: error ? "FAILED" : null, errorMessage: error?.message };
}

export async function toggleSave(
  supabase: SupabaseClient<Database>,
  userId: string,
  target: SaveTarget,
  itemId: string,
): Promise<{ saved: boolean | null } & InteractionResult> {
  if (await isSaved(supabase, userId, target, itemId)) {
    const result = await unsave(supabase, userId, target, itemId);
    return { ...result, saved: result.error ? null : false };
  }

  const result = await save(supabase, userId, target, itemId);
  return { ...result, saved: result.error ? null : true };
}

// --- Listados para /panel/guardados -----------------------------------------
// Solo se listan los guardados del propio perfil (`profile_id`); la RLS además
// impide leer los ajenos, y los elementos ya no visibles simplemente no
// resuelven su relación (LEFT JOIN vacío) y se descartan en el render.

export type SavedPostListItem = Database["public"]["Tables"]["saved_posts"]["Row"] & {
  post: {
    id: string;
    body: string | null;
    video_id: string | null;
    video_title: string | null;
  } | null;
};

export async function listSavedPosts(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SavedPostListItem[]> {
  const { data } = await supabase
    .from("saved_posts")
    .select(
      "*, post:posts(id, body, video_id, video:videos!posts_video_id_fkey(title))",
    )
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    ...row,
    post: row.post
      ? {
          id: row.post.id,
          body: row.post.body,
          video_id: row.post.video_id,
          // PostgREST anida la relación 1:1 como objeto, no como array.
          video_title:
            row.post.video && !Array.isArray(row.post.video) ? row.post.video.title : null,
        }
      : null,
  }));
}

export type SavedProjectListItem = Database["public"]["Tables"]["saved_projects"]["Row"] & {
  project: {
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    stage: string;
    cover_image_url: string | null;
  } | null;
};

export async function listSavedProjects(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SavedProjectListItem[]> {
  const { data } = await supabase
    .from("saved_projects")
    .select("*, project:projects(id, name, slug, tagline, stage, cover_image_url)")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export type SavedOpportunityListItem =
  Database["public"]["Tables"]["saved_opportunities"]["Row"] & {
    opportunity: {
      id: string;
      title: string;
      opportunity_type: string;
      status: string;
      city: string | null;
      country: string | null;
    } | null;
  };

export async function listSavedOpportunities(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SavedOpportunityListItem[]> {
  const { data } = await supabase
    .from("saved_opportunities")
    .select(
      "*, opportunity:opportunities(id, title, opportunity_type, status, city, country)",
    )
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}
