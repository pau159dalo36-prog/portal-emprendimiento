"use client";

import { useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";

type ProjectSortProps = {
  search: string;
  stage: string;
  industry: string;
  initialOrder: string;
};

export function ProjectSort({
  search,
  stage,
  industry,
  initialOrder,
}: ProjectSortProps) {
  const t = useTranslations("projects");
  const router = useRouter();
  const pathname = usePathname();

  function go(order: string) {
    const params = new URLSearchParams();
    if (search) {
      params.set("q", search);
    }
    if (stage) {
      params.set("stage", stage);
    }
    if (industry) {
      params.set("industry", industry);
    }
    if (order && order !== "recientes") {
      params.set("order", order);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <select
      value={initialOrder}
      onChange={(event) => go(event.target.value)}
      aria-label={t("sort")}
      className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <option value="recientes">{t("sortRecent")}</option>
      <option value="activos">{t("sortActive")}</option>
    </select>
  );
}
