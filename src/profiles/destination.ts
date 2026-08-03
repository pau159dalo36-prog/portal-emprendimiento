import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function getPostLoginDestination(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<"/panel" | "/onboarding"> {
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  return data?.onboarding_completed ? "/panel" : "/onboarding";
}
