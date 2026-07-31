import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Clock, Globe, Link as LinkIcon, MapPin } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  COLLABORATION_PREFERENCE_LABELS,
  SKILL_LEVEL_LABELS,
  USER_TYPE_LABELS,
} from "@/profiles/constants";
import { getProfileInterests, getProfileSkills } from "@/profiles/data";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const { supabase } = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, headline")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  return {
    title: profile?.full_name
      ? `${profile.full_name} — Portal de Emprendimiento`
      : "Perfil — Portal de Emprendimiento",
    description: profile?.headline ?? undefined,
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const { supabase, user } = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const isOwner = user?.id === profile.id;

  const joinedDate = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(profile.created_at));

  const [skills, interests] = await Promise.all([
    getProfileSkills(supabase, profile.id),
    getProfileInterests(supabase, profile.id),
  ]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar name={profile.full_name} src={profile.avatar_url} size="xl" />
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {profile.full_name ?? "Sin nombre"}
              </h1>
              {isOwner && (
                <Badge className="border-border bg-muted text-muted-foreground">
                  Eres tú
                </Badge>
              )}
            </div>
            {profile.username && (
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            )}
            {profile.headline && <p className="text-sm">{profile.headline}</p>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {(profile.location ||
            profile.weekly_availability != null ||
            profile.created_at) && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {profile.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {profile.location}
                </span>
              )}
              {profile.weekly_availability != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" aria-hidden="true" />
                  {profile.weekly_availability} h/semana disponibles
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                Se unió en {joinedDate}
              </span>
            </div>
          )}

          {profile.user_types.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.user_types.map((type) => (
                <Badge
                  key={type}
                  className="border-primary/30 bg-primary/10 text-primary"
                >
                  {USER_TYPE_LABELS[type as keyof typeof USER_TYPE_LABELS] ?? type}
                </Badge>
              ))}
            </div>
          )}

          {(profile.website_url || profile.linkedin_url) && (
            <div className="flex flex-wrap gap-2">
              {profile.website_url && (
                <Link
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Globe className="size-4" aria-hidden="true" />
                  Web
                </Link>
              )}
              {profile.linkedin_url && (
                <Link
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <LinkIcon className="size-4" aria-hidden="true" />
                  LinkedIn
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sobre {profile.full_name?.split(" ")[0] ?? "mí"}</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.bio ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {profile.bio}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no ha escrito una biografía.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Habilidades</CardTitle>
        </CardHeader>
        <CardContent>
          {skills.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <li key={skill.skill_id}>
                  <Badge className="gap-1 border-border bg-muted px-3 py-1.5 text-sm">
                    {skill.name}
                    {skill.level != null && (
                      <span className="text-muted-foreground">
                        · {SKILL_LEVEL_LABELS[skill.level]}
                      </span>
                    )}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no ha añadido habilidades.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intereses</CardTitle>
        </CardHeader>
        <CardContent>
          {interests.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <li key={interest.name}>
                  <Badge className="gap-1 border-border bg-muted px-3 py-1.5 text-sm">
                    {interest.name}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no ha añadido intereses.
            </p>
          )}
        </CardContent>
      </Card>

      {profile.collaboration_preferences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Busca colaborar así</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {profile.collaboration_preferences.map((preference) => (
                <li key={preference}>
                  <Badge className="gap-1 border-border bg-muted px-3 py-1.5 text-sm">
                    {
                      COLLABORATION_PREFERENCE_LABELS[
                        preference as keyof typeof COLLABORATION_PREFERENCE_LABELS
                      ] ?? preference
                    }
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
