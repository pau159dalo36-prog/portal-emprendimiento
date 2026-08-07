import { Logo } from "@/components/shared/logo";
import { SignedInNav } from "@/components/shared/signed-in-nav";
import { requireUser } from "@/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireUser();

  const { data: claims } = await supabase.auth.getClaims();
  const isAdmin = claims?.claims?.app_metadata?.role === "admin";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
          <Logo />
          <SignedInNav isAdmin={isAdmin} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
