"use client";

import { useTranslations } from "next-intl";
import { Building2, Compass, Home, Plus, User } from "lucide-react";

import type { ShellUser } from "@/components/navigation/app-shell";
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/navigation";

type BottomNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

export function MobileBottomNav({ user }: { user: ShellUser | null }) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();

  const items: BottomNavItem[] = [
    { href: "/", label: t("home"), icon: Home, exact: true },
    { href: "/proyectos", label: t("explore"), icon: Compass },
    user
      ? { href: "/proyectos/nuevo", label: t("publish"), icon: Plus }
      : { href: "/registrarse", label: t("publish"), icon: Plus },
    { href: "/organizaciones", label: t("organizations"), icon: Building2 },
    user
      ? { href: "/perfil", label: t("profile"), icon: User }
      : { href: "/iniciar-sesion", label: t("signIn"), icon: User },
  ];

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/40 bg-background/90 backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
