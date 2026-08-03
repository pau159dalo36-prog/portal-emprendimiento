import Link from "next/link";
import {
  ArrowRight,
  MessageSquareText,
  Sparkles,
  Users,
  Lightbulb,
  CheckCircle,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const features = [
  {
    icon: Lightbulb,
    title: "Publica tu idea",
    description:
      "Describe tu propuesta con estructura: problema, solución, mercado objetivo y etapa de desarrollo.",
  },
  {
    icon: MessageSquareText,
    title: "Recibe feedback real",
    description:
      "La comunidad comenta con criterios definidos para que mejores tu proyecto con aportes concretos.",
  },
  {
    icon: Users,
    title: "Encuentra colaboradores",
    description:
      "Conecta con perfiles que complementan tus habilidades y formá equipos para avanzar juntos.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              P
            </div>
            <span className="text-lg font-semibold tracking-tight">Portal</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#caracteristicas"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Características
            </Link>
            <Link
              href="#como-funciona"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cómo funciona
            </Link>
            <Link
              href="#comunidad"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Comunidad
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/iniciar-sesion"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/crear-cuenta"
              className={buttonVariants({ size: "sm" })}
            >
              Crear cuenta
            </Link>
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
              Portal de emprendimiento independiente
            </div>

            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Convierte tu idea en un proyecto validado
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-8 text-muted-foreground sm:text-xl">
              Un espacio donde publicar tus ideas, recibir feedback honesto de la
              comunidad, encontrar colaboradores afines y validar tu proyecto
              antes de dar el salto.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/crear-cuenta"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                Comienza gratis <ArrowRight className="ml-2 size-4" />
              </Link>
              <Link
                href="#caracteristicas"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                Explorar funciones
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
                Características
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Todo lo que necesitas para validar tu idea
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Desde la publicación estructurada hasta la conexión con otros
                emprendedores, el portal te acompaña en cada etapa.
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-border/60 bg-card p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <feature.icon className="size-6" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-3 leading-7 text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              ))}
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
                Cómo funciona
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                De la idea al proyecto en tres pasos
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Un proceso simple que te da claridad y te conecta con las
                personas adecuadas.
              </p>
            </div>

            <div className="mt-16 grid gap-12 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Publica",
                  description:
                    "Sube tu idea con un formato guiado: explica el problema, tu solución y el mercado al que apuntas.",
                },
                {
                  step: "02",
                  title: "Recibe feedback",
                  description:
                    "La comunidad y mentores comentan con criterios objetivos para que puedas mejorar iterativamente.",
                },
                {
                  step: "03",
                  title: "Valida y crece",
                  description:
                    "Encuentra colaboradores, únete a comunidades y prepara tu proyecto para el siguiente nivel.",
                },
              ].map((item) => (
                <div key={item.step} className="relative pl-16">
                  <div className="absolute left-0 top-0 flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                    {item.step}
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
                  Comunidad
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  No tienes que emprender solo
                </h2>
                <p className="mt-4 text-lg leading-8 text-muted-foreground">
                  Únete a una comunidad activa de emprendedores que comparten tus
                  inquietudes. Participa en discusiones, recibe feedback sincero
                  y forma equipos con personas que complementan tus habilidades.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    "Feedback guiado por criterios objetivos",
                    "Conexión con perfiles afines a tu proyecto",
                    "Comunidades temáticas por industria y etapa",
                  ].map((item) => (
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
                    ¿Te unes?
                  </span>
                </div>
                <p className="mt-4 text-muted-foreground">
                  Crea tu cuenta gratis y empieza a construir tu proyecto con el
                  apoyo de una comunidad que valida, no solo opina.
                </p>
                <Link
                  href="/crear-cuenta"
                  className={buttonVariants({
                    size: "lg",
                    className: "mt-6 w-full",
                  })}
                >
                  Crear cuenta gratis <ArrowRight className="ml-2 size-4" />
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
              P
            </div>
            Portal de Emprendimiento
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Portal de Emprendimiento. Todos
            los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
