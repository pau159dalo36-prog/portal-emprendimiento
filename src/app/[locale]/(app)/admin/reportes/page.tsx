import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/auth/admin";
import { AdminReportForm } from "@/components/reports/admin-report-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";
import { listOpenReports } from "@/reports/data";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("adminReports") };
}

export default async function AdminReportsPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("adminReports");
  const reasons = await getTranslations("reports.reasons");

  const reports = await listOpenReports(supabase);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="grid gap-3">
                <div className="grid gap-1 text-sm">
                  <p className="font-semibold">
                    {t("target", {
                      type: t(`targetTypes.${report.target_type}`),
                      id: report.target_id,
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {t("reporterLine", {
                      name: report.reporter?.full_name ?? report.reporter?.username ?? t("anonymous"),
                      date: new Date(report.created_at).toLocaleString(),
                    })}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-border bg-muted text-muted-foreground">
                      {reasons(report.reason)}
                    </Badge>
                    {report.note && (
                      <span className="text-muted-foreground">“{report.note}”</span>
                    )}
                  </div>
                </div>
                <AdminReportForm reportId={report.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}