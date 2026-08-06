import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type VideoImagePreviewRef = { bucket: string | null; path: string | null } | null;

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export async function resolveVideoImagePreviewUrl(
  supabase: SupabaseClient<Database>,
  image: VideoImagePreviewRef,
): Promise<string | null> {
  if (!image?.bucket || !image.path) {
    return null;
  }
  const { data } = await supabase.storage.from(image.bucket).createSignedUrl(image.path, SIGNED_URL_EXPIRY_SECONDS);
  return data?.signedUrl ?? null;
}
