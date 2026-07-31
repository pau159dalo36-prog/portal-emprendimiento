import Link from "next/link";

import { getCurrentUser } from "@/auth/session";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";

export default async function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getCurrentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
          <Logo />
          {user ? (
            <Link href="/panel" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Ir a mi panel
            </Link>
          ) : (
            <Link href="/iniciar-sesion" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 sm:px-8 lg:px-10">
        {children}
      </main>

      <footer className="border-t border-border/40 py-6">
        <div className="mx-auto max-w-7xl px-6 text-center text-xs text-muted-foreground sm:px-8 lg:px-10">
          Portal de Emprendimiento — Convierte tu idea en un proyecto validado.
        </div>
      </footer>
    </div>
  );
}
