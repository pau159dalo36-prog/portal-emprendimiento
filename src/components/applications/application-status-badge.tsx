import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/applications/config";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  submitted: "border-border bg-muted text-muted-foreground",
  viewed: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  accepted: "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  withdrawn: "border-border bg-muted text-muted-foreground",
};

/** Etiqueta de estado de candidatura (solo servidor; páginas y paneles). */
export async function ApplicationStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const t = await getTranslations("applicationStatuses");

  return (
    <Badge
      className={cn(STATUS_STYLES[status as ApplicationStatus] ?? STATUS_STYLES.submitted, className)}
    >
      {t(status as Parameters<typeof t>[0])}
    </Badge>
  );
}
