import type { Database } from "@/types/database.types";

export type VideoViewSessionRow = Database["public"]["Tables"]["video_view_sessions"]["Row"];

// Métricas agregadas que devuelven las RPCs de lectura. Solo números, nunca
// identidades de espectadores (privacidad de la sesión anónima).
export type VideoMetrics = {
  qualified_views: number;
  plays: number;
  unique_viewers: number;
  total_watch_seconds: number;
  average_watch_seconds: number;
  completion_rate: number;
  average_progress: number;
  last_interaction: string | null;
};

// Resultado de `report_video_view` (filas de su RETURNS TABLE).
export type ReportVideoViewResult = {
  qualified: boolean;
  completed: boolean;
  watch_seconds: number;
  max_progress: number;
};
