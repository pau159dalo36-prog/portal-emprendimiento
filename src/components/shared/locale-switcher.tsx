"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";

import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(next: Locale) {
    router.replace(pathname, { locale: next });
  }

  return (
    <div className="flex items-center gap-2">
      <Languages className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <select
        value={locale}
        onChange={(event) => handleChange(event.target.value as Locale)}
        aria-label={t("sectionLabel")}
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        {(["es", "en"] as const).map((code) => (
          <option key={code} value={code}>
            {t(`languages.${code}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
