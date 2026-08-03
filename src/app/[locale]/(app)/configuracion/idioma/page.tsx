import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { pageMetadataTitle } from "@/i18n/metadata";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("languageSettings") };
}

export default async function LanguageSettingsPage() {
  await requireUser();
  const t = await getTranslations("language");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("sectionLabel")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("sectionHint")}</p>
      </div>

      <div className="rounded-lg border border-border p-5">
        <LocaleSwitcher />
      </div>
    </div>
  );
}
