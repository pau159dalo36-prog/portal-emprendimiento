"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut, Plus, Search } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import type { ShellUser } from "@/components/navigation/app-shell";
import { Logo } from "@/components/shared/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";

export function TopHeader({ user }: { user: ShellUser | null }) {
  const t = useTranslations("nav");
  const projects = useTranslations("projects");
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? { pathname: "/proyectos", query: { q: value } } : "/proyectos");
  }

  const searchInput = (
    <Input
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={projects("searchPlaceholder")}
      aria-label={projects("search")}
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
              <Link href="/proyectos/nuevo" className={buttonVariants({ size: "sm" })}>
                <Plus className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("newProject")}</span>
              </Link>
              <Link href="/perfil" aria-label={t("panel")}>
                <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
              </Link>
              <form action={signOutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  title={t("signOut")}
                  aria-label={t("signOut")}
                  className="text-muted-foreground"
                >
                  <LogOut className="size-4" />
                </Button>
              </form>
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
