"use client";

import { useTranslations } from "next-intl";
import { Home, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { INDUSTRIES } from "@/organizations/constants";
import { Link } from "@/i18n/navigation";

type CategoryStripProps = {
  active?: string | null;
};

type Category = {
  key: string;
  label: string;
  href: string | { pathname: string; query: Record<string, string> };
  icon?: React.ComponentType<{ className?: string }>;
};

export function CategoryStrip({ active = null }: CategoryStripProps) {
  const t = useTranslations("feed");
  const industries = useTranslations("industries");

  const categories: Category[] = [
    { key: "home", label: t("forYou"), href: "/", icon: Home },
    { key: "new", label: t("newProjects"), href: "/proyectos", icon: Sparkles },
    ...INDUSTRIES.map((industry) => ({
      key: `industry:${industry}`,
      label: industries(industry as Parameters<typeof industries>[0]),
      href: { pathname: "/proyectos", query: { industry } } as const,
    })),
  ];

  return (
    <div
      role="navigation"
      aria-label={t("categoriesLabel")}
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((category) => {
        const isActive = category.key === active;
        const Icon = category.icon;
        return (
          <Link
            key={category.key}
            href={category.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden="true" />}
            {category.label}
          </Link>
        );
      })}
    </div>
  );
}
