import { getTranslations } from "next-intl/server";
import { pageMetadataTitle } from "@/i18n/metadata";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("privacy") };
}

const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;

export default async function PrivacyPage() {
  const t = await getTranslations("legal");

  return (
    <article className="grid gap-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("privacy.title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("lastUpdated")}</p>
      </header>
      <div className="grid gap-8">
        {SECTIONS.map((key) => (
          <section key={key} className="grid gap-2">
            <h2 className="text-lg font-semibold">{t(`privacy.sections.${key}.title`)}</h2>
            <p className="text-muted-foreground">{t(`privacy.sections.${key}.body`)}</p>
          </section>
        ))}
      </div>
    </article>
  );
}