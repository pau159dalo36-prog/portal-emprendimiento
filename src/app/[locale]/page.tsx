import { getTranslations } from "next-intl/server";
import { Rocket } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { AppShell } from "@/components/navigation/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { loadHomeFeed } from "@/feed/home";
import { pageMetadataTitle } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("home") };
}

// Inicio = FEED. La primera página de "Para ti" (y de "Siguiendo" si hay
// sesión) se carga en el servidor; las siguientes páginas las pide la UI con su
// cursor. Las rutas /videos, /proyectos y /organizaciones siguen siendo
// directorios propios: aquí solo viven las dos pestañas del feed.
export default async function HomePage() {
  const { supabase, user } = await getCurrentUser();
  const t = await getTranslations("home");

  const feed = await loadHomeFeed(supabase, user?.id ?? null);

  return (
    <AppShell>
      <div className="grid gap-10">
        <section className="grid gap-4">
          <div className="grid gap-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("intro.eyebrow")}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("intro.title")}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t("intro.description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={user ? "/proyectos/nuevo" : "/registrarse"}
              className={buttonVariants()}
            >
              <Rocket className="size-4" aria-hidden="true" />
              {user ? t("intro.publishCta") : t("intro.createAccount")}
            </Link>
            <Link
              href="/explorar"
              className={buttonVariants({ variant: "outline" })}
            >
              {t("intro.exploreCta")}
            </Link>
          </div>
        </section>

        <FeedTabs
          isAuthenticated={Boolean(user)}
          initialForYou={feed.forYou}
          initialFollowing={feed.following}
        />
      </div>
    </AppShell>
  );
}
