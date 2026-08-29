import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function getPostLoginDestination(
  supabase: SupabaseClient<Database>,
): Promise<"/panel" | "/onboarding"> {
  const { data } = await supabase.rpc("get_own_profile");

  return data?.onboarding_completed ? "/panel" : "/onboarding";
}
