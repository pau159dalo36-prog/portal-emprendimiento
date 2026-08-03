import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/auth/session";
import { Logo } from "@/components/shared/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { Link } from "@/i18n/navigation";

export default async function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getCurrentUser();
  const t = await getTranslations("nav");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
          <Logo />
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            {user ? (
              <Link href="/panel" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {t("goToDashboard")}
              </Link>
            ) : (
              <Link href="/iniciar-sesion" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {t("signIn")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 sm:px-8 lg:px-10">
        {children}
      </main>

      <footer className="border-t border-border/40 py-6">
        <div className="mx-auto max-w-7xl px-6 text-center text-xs text-muted-foreground sm:px-8 lg:px-10">
          {brand.name} — {brand.tagline}
        </div>
      </footer>
    </div>
  );
}
