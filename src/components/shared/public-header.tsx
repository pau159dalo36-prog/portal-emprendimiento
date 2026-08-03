import { AuthActions } from "@/components/shared/auth-actions";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { Logo } from "@/components/shared/logo";
import { SignedInNav } from "@/components/shared/signed-in-nav";
import { getCurrentUser } from "@/auth/session";

export async function PublicHeader() {
  const { user } = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
        <Logo />
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          {user ? <SignedInNav /> : <AuthActions />}
        </div>
      </div>
    </header>
  );
}
