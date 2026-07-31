import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border/40 px-6 sm:px-8 lg:px-10">
        <Logo />
        <nav className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Volver al inicio
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {children}
      </main>
      <footer className="flex justify-center px-6 py-6">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Portal de Emprendimiento
        </p>
      </footer>
    </div>
  );
}
