import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ExternalLink, Settings2 } from "lucide-react";

import { requireUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCompletionPercent, getCompletionSections } from "@/profiles/completion";
import {
  COLLABORATION_PREFERENCE_LABELS,
  USER_TYPE_LABELS,
} from "@/profiles/constants";
import { getProfileInterests, getProfileSkills } from "@/profiles/data";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Panel — Portal de Emprendimiento",
};

const UPCOMING_MODULES = [
  { title: "Ideas", description: "Publica y valida tus ideas de negocio." },
  { title: "Feedback", description: "Recibe y da feedback constructivo." },
  { title: "Comunidades", description: "Únete a comunidades por sector o interés." },
  { title: "Mensajería", description: "Contacta con otros miembros del portal." },
];

export default async function PanelPage() {
  const { supabase, user } = await requireUser();

  const { profile, skills, interests } = await (async () => {
    const [{ data: profile }, skillRows, interestRows] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      getProfileSkills(supabase, user.id),
      getProfileInterests(supabase, user.id),
    ]);
    return { profile, skills: skillRows, interests: interestRows };
  })();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const sections = getCompletionSections(profile, skills.length, interests.length);
  const percent = getCompletionPercent(sections);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar name={profile.full_name} src={profile.avatar_url} size="lg" />
          <div className="grid gap-1">
            <CardTitle>Hola, {profile.full_name ?? "emprendedor"}.</CardTitle>
            <CardDescription>
              {profile.headline ?? "Este es tu panel personal."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completitud del perfil</span>
            <span className="font-medium">{percent}%</span>
          </div>
          <Progress value={percent} />

          {percent < 100 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {sections
                .filter((section) => !section.done)
                .map((section) => (
                  <Badge
                    key={section.key}
                    className="border-border bg-muted text-muted-foreground"
                  >
                    Falta: {section.label}
                  </Badge>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/configuracion/perfil" className={buttonVariants()}>
          <Settings2 aria-hidden="true" />
          Editar perfil
        </Link>
        {profile.username && (
          <Link
            href={`/perfil/${profile.username}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink aria-hidden="true" />
            Ver perfil público
          </Link>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos principales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              {profile.user_types.length > 0 ? (
                profile.user_types.map((type) => (
                  <Badge key={type} className="border-primary/30 bg-primary/10 text-primary">
                    {USER_TYPE_LABELS[type as keyof typeof USER_TYPE_LABELS] ?? type}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">Sin tipos seleccionados</span>
              )}
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">Ubicación</span>
              <span>{profile.location ?? "—"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">Disponibilidad semanal</span>
              <span>{profile.weekly_availability != null ? `${profile.weekly_availability} h` : "—"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">Colaboración</span>
              <span>
                {profile.collaboration_preferences.length > 0
                  ? profile.collaboration_preferences
                      .map(
                        (pref) =>
                          COLLABORATION_PREFERENCE_LABELS[
                            pref as keyof typeof COLLABORATION_PREFERENCE_LABELS
                          ] ?? pref,
                      )
                      .join(", ")
                  : "—"}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">Habilidades</span>
              <span>{skills.length > 0 ? skills.map((s) => s.name).join(", ") : "—"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span className="text-muted-foreground">Intereses</span>
              <span>
                {interests.length > 0 ? interests.map((i) => i.name).join(", ") : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximamente</CardTitle>
            <CardDescription>
              Estas funcionalidades llegarán en los próximos días.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {UPCOMING_MODULES.map((module) => (
              <div
                key={module.title}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3"
              >
                <div className="grid gap-0.5">
                  <span className="text-sm font-medium">{module.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {module.description}
                  </span>
                </div>
                <Badge className="border-border bg-muted text-muted-foreground">
                  Próximamente
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end">
        <Link
          href={`/perfil/${profile.username ?? ""}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground",
            !profile.username && "pointer-events-none opacity-50",
          )}
        >
          <ArrowUpRight aria-hidden="true" />
          Ver cómo me ven los demás
        </Link>
      </div>
    </div>
  );
}
