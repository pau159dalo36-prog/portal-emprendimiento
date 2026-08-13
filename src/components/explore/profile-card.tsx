"use client";

import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";

import { FollowButton } from "@/components/follows/follow-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { SearchProfile } from "@/search/types";

type ProfileCardProps = {
  profile: SearchProfile;
  currentUserId?: string | null;
};

// Tarjeta de un perfil en el hub Explorar. Enlaza a /perfil/[username] (o al
// id si no tiene username). Los user_types son keys del namespace `types`. El
// botón de seguir solo aparece para un usuario autenticado que no sea el propio
// perfil.
export function ProfileCard({ profile, currentUserId = null }: ProfileCardProps) {
  const t = useTranslations("explore");
  const types = useTranslations("types");

  const name = profile.fullName ?? profile.username ?? t("anonymous");
  const canFollow = Boolean(currentUserId && currentUserId !== profile.id);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <Avatar name={profile.fullName ?? profile.username} src={profile.avatarUrl} size="md" />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            <Link
              href={`/perfil/${profile.username ?? profile.id}`}
              className="focus-visible:outline-none"
            >
              {name}
            </Link>
          </h3>
          {profile.username && (
            <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
          )}
        </div>
        {canFollow && (
          <div className="ml-auto shrink-0">
            <FollowButton
              targetId={profile.id}
              targetType="profile"
              isFollowing={profile.isFollowing}
            />
          </div>
        )}
      </div>

      {profile.headline && (
        <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{profile.headline}</p>
      )}

      {profile.userTypes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.userTypes.map((userType) => (
            <Badge key={userType} className="border-border bg-muted text-muted-foreground">
              {types(userType)}
            </Badge>
          ))}
        </div>
      )}

      {profile.location && (
        <p className="mt-auto pt-1 text-xs text-muted-foreground">
          <MapPin className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
          {profile.location}
        </p>
      )}
    </article>
  );
}
