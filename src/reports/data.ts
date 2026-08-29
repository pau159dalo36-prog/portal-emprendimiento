import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type OpenReportRow = Database["public"]["Tables"]["content_reports"]["Row"] & {
  reporter: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export async function listOpenReports(
  supabase: SupabaseClient<Database>,
): Promise<OpenReportRow[]> {
  const { data } = await supabase
    .from("content_reports")
    .select(
      "*, reporter:profiles!content_reports_reporter_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    ...row,
    reporter:
      row.reporter && !Array.isArray(row.reporter) ? row.reporter : null,
  }));
}