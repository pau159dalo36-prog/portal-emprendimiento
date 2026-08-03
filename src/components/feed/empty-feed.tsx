import { getTranslations } from "next-intl/server";
import { ArrowRight, Compass, Rocket } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function EmptyFeed() {
  const t = await getTranslations("feed");
  const nav = await getTranslations("nav");

  return (
    <section className="grid gap-6 rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Rocket className="size-7" aria-hidden="true" />
      </div>

      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
        <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
          {t("emptyDescription")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/proyectos/nuevo" className={buttonVariants()}>
          <Rocket className="size-4" aria-hidden="true" />
          {nav("newProject")}
        </Link>
        <Link href="/proyectos" className={buttonVariants({ variant: "outline" })}>
          <Compass className="size-4" aria-hidden="true" />
          {t("exploreProjects")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
