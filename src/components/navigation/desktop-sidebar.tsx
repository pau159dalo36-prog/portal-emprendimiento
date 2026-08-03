"use client";

import { useTranslations } from "next-intl";
import {
  Building2,
  Compass,
  Home,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  Plus,
  Sparkles,
  User,
  Video,
  Briefcase,
} from "lucide-react";

import type { ShellUser } from "@/components/navigation/app-shell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/navigation";

type SidebarItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

export function DesktopSidebar({ user }: { user: ShellUser | null }) {
  const t = useTranslations("sidebar");
  const nav = useTranslations("nav");
  const pathname = usePathname();

  function isActive(href: string, exact = false): boolean {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const mainItems: SidebarItem[] = [
    { href: "/", label: t("home"), icon: Home, exact: true },
    { href: "/proyectos", label: t("explore"), icon: Compass },
    { href: "/organizaciones", label: t("organizations"), icon: Building2 },
  ];

  const activityItems: SidebarItem[] = [
    { href: "/panel", label: nav("panel"), icon: LayoutDashboard },
    { href: "/perfil", label: t("profile"), icon: User },
    { href: "/proyectos/nuevo", label: nav("newProject"), icon: Plus },
    { href: "/organizaciones/nueva", label: nav("newOrganization"), icon: Plus },
  ];

  const comingSoonItems = [
    { label: t("videos"), icon: Video },
    { label: t("posts"), icon: Newspaper },
    { label: t("jobs"), icon: Briefcase },
    { label: t("communities"), icon: MessageSquare },
  ];

  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border/40 px-4 py-6 lg:flex">
      <nav aria-label={t("main")} className="grid gap-1">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("main")}
        </p>
        {mainItems.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <nav aria-label={t("activity")} className="grid gap-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("activity")}
          </p>
          {activityItems.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      <nav aria-label={t("comingSoon")} className="grid gap-1">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("comingSoon")}
        </p>
        {comingSoonItems.map((item) => {
          const Icon = item.icon;
          return (
            <span
              key={item.label}
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground/50"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
              <Badge className="ml-auto shrink-0 border-border bg-muted text-muted-foreground">
                {t("soonBadge")}
              </Badge>
            </span>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border/40 pt-4">
        <p className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t("moreComingSoon")}
        </p>
      </div>
    </aside>
  );
}
