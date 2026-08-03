import {
  ArrowRight,
  MessageSquareText,
  Sparkles,
  Users,
  Lightbulb,
  CheckCircle,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthActions } from "@/components/shared/auth-actions";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { SignedInNav } from "@/components/shared/signed-in-nav";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/auth/session";
import { brand } from "@/config/brand";
import { Link } from "@/i18n/navigation";

const FEATURE_ICONS = [Lightbulb, MessageSquareText, Users] as const;

type TextItem = { title: string; description: string };

export default async function Home() {
  const { user } = await getCurrentUser();
  const t = await getTranslations("home");
  const common = await getTranslations("common");

  const features = t.raw("features.items") as TextItem[];
  const steps = t.raw("how.steps") as TextItem[];
  const points = t.raw("community.points") as string[];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              {brand.logoMark}
            </div>
            <span className="text-lg font-semibold tracking-tight">{brand.shortName}</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#caracteristicas"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("features.eyebrow")}
            </Link>
            <Link
              href="#como-funciona"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("how.eyebrow")}
            </Link>
            <Link
              href="#comunidad"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("community.eyebrow")}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            {user ? <SignedInNav /> : <AuthActions />}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 pb-24 pt-16 sm:px-8 sm:pb-32 sm:pt-24 lg:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.87_0_0/0.3),transparent_50%),radial-gradient(ellipse_at_bottom_left,_oklch(0.93_0_0/0.2),transparent_50%)]"
          />

          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="size-4" />
              {t("hero.badge")}
            </div>

            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {t("hero.title")}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-8 text-muted-foreground sm:text-xl">
              {t("hero.description")}
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/registrarse"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                {t("hero.primaryCta")} <ArrowRight className="ml-2 size-4" />
              </Link>
              <Link
                href="#caracteristicas"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                {t("hero.secondaryCta")}
              </Link>
            </div>
          </div>
        </section>

        <section
          id="caracteristicas"
          className="border-t border-border/40 px-6 py-20 sm:px-8 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/70">
                {t("features.eyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {t("features.title")}
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                {t("features.subtitle")}
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {features.map((feature, index) => {
                const Icon = FEATURE_ICONS[index] ?? Lightbulb;
                return (
                  <article
                    key={feature.title}
                    className="group rounded-2xl border border-border/60 bg-card p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-6" />
                    </div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-muted-foreground">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="como-funciona"
          className="px-6 py-20 sm:px-8 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/70">
                {t("how.eyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {t("how.title")}
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                {t("how.subtitle")}
              </p>
            </div>

            <div className="mt-16 grid gap-12 md:grid-cols-3">
              {steps.map((item, index) => (
                <div key={item.title} className="relative pl-16">
                  <div className="absolute left-0 top-0 flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 leading-7 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="comunidad"
          className="border-t border-border/40 bg-muted/30 px-6 py-20 sm:px-8 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/70">
                  {t("community.eyebrow")}
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  {t("community.title")}
                </h2>
                <p className="mt-4 text-lg leading-8 text-muted-foreground">
                  {t("community.description")}
                </p>
                <ul className="mt-8 space-y-4">
                  {points.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 size-5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
                <div className="flex items-center gap-3">
                  <Users className="size-6 text-primary" />
                  <span className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
                    {t("community.ctaLabel")}
                  </span>
                </div>
                <p className="mt-4 text-muted-foreground">
                  {t("community.ctaText")}
                </p>
                <Link
                  href="/registrarse"
                  className={buttonVariants({
                    size: "lg",
                    className: "mt-6 w-full",
                  })}
                >
                  {t("community.ctaButton")} <ArrowRight className="ml-2 size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 px-6 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
              {brand.logoMark}
            </div>
            {brand.name}
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {brand.name}. {common("allRightsReserved")}
          </p>
        </div>
      </footer>
    </div>
  );
}
