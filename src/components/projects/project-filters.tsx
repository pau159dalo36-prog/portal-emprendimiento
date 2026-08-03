"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePathname, useRouter } from "@/i18n/navigation";
import { PROJECT_STAGES } from "@/projects/constants";

type ProjectFiltersProps = {
  initialSearch: string;
  initialStage: string;
};

export function ProjectFilters({ initialSearch, initialStage }: ProjectFiltersProps) {
  const t = useTranslations("projects");
  const stages = useTranslations("projectStages");
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(initialSearch);
  const [stage, setStage] = useState(initialStage);

  function go(params: URLSearchParams) {
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set("q", search.trim());
    }
    if (stage) {
      params.set("stage", stage);
    }
    go(params);
  }

  function clearFilters() {
    setSearch("");
    setStage("");
    go(new URLSearchParams());
  }

  return (
    <form
      onSubmit={applyFilters}
      className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
    >
      <div className="grid gap-2">
        <Label htmlFor="project-search">{t("searchPlaceholder")}</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="project-search"
            name="q"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="project-stage">{t("stage")}</Label>
        <select
          id="project-stage"
          name="stage"
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <option value="">{t("allStages")}</option>
          {PROJECT_STAGES.map((value) => (
            <option key={value} value={value}>
              {stages(value as Parameters<typeof stages>[0])}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">{t("search")}</Button>
        <Button type="button" variant="ghost" onClick={clearFilters}>
          {t("clear")}
        </Button>
      </div>
    </form>
  );
}
