import { getTranslations } from "next-intl/server";
import { Briefcase } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function OpportunityEmptyState() {
  const t = await getTranslations("opportunity");

  return (
    <div className="grid place-items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <div className="grid place-items-center gap-2">
        <Briefcase className="size-10 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("emptyDescription")}</p>
      </div>
      <Link href="/publicar/oportunidad" className={buttonVariants()}>
        {t("emptyCta")}
      </Link>
    </div>
  );
}
