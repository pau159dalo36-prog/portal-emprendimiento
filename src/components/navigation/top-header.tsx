"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bell,
  Briefcase,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Video,
} from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import type {
  ShellUnreadCounts,
  ShellUser,
} from "@/components/navigation/app-shell";
import { Logo } from "@/components/shared/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";

type TopHeaderProps = {
  user: ShellUser | null;
  unreadCounts?: ShellUnreadCounts | null;
};

function HeaderBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={label}
      className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function TopHeader({ user, unreadCounts }: TopHeaderProps) {
  const t = useTranslations("nav");
  const explore = useTranslations("explore");
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? { pathname: "/explorar", query: { q: value } } : "/explorar");
  }

  const searchInput = (
    <Input
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={explore("searchPlaceholder")}
      aria-label={explore("search")}
      className="h-9 pl-9"
    />
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Logo className="shrink-0" />

        <form role="search" onSubmit={submitSearch} className="hidden max-w-md flex-1 sm:block">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            {searchInput}
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <LocaleSwitcher />
          </div>

          {user ? (
            <>
              <Link
                href="/mensajes"
                aria-label={t("messages")}
                title={t("messages")}
                className="relative inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MessageSquare className="size-5" aria-hidden="true" />
                <HeaderBadge
                  count={unreadCounts?.messages ?? 0}
                  label={t("unreadMessages", {
                    count: unreadCounts?.messages ?? 0,
                  })}
                />
              </Link>
              <Link
                href="/notificaciones"
                aria-label={t("notifications")}
                title={t("notifications")}
                className="relative inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Bell className="size-5" aria-hidden="true" />
                <HeaderBadge
                  count={unreadCounts?.notifications ?? 0}
                  label={t("unreadNotifications", {
                    count: unreadCounts?.notifications ?? 0,
                  })}
                />
              </Link>
              <Link href="/proyectos/nuevo" className={buttonVariants({ size: "sm" })}>
                <Plus className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("newProject")}</span>
              </Link>
              <Link
                href="/publicar/oportunidad"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Briefcase className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("publishOpportunity")}</span>
              </Link>
              <Link
                href="/publicar/video"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Video className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("publishVideo")}</span>
              </Link>
              <Link
                href="/panel/videos"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Video className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("myVideos")}</span>
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/admin/videos"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{t("adminVideos")}</span>
                </Link>
              )}
              <Link href="/perfil" aria-label={t("panel")}>
                <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
              </Link>
              <SignOutButton
                size="icon-sm"
                className="text-muted-foreground"
                title={t("signOut")}
                aria-label={t("signOut")}
              >
                <LogOut className="size-4" />
              </SignOutButton>
            </>
          ) : (
            <>
              <Link href="/iniciar-sesion" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {t("signIn")}
              </Link>
              <Link href="/registrarse" className={buttonVariants({ size: "sm" })}>
                {t("createAccount")}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border/40 px-4 py-2 sm:hidden">
        <form role="search" onSubmit={submitSearch}>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            {searchInput}
          </div>
        </form>
      </div>
    </header>
  );
}
