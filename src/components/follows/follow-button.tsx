"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, UserPlus } from "lucide-react";

import { toggleFollowAction, type FollowTarget } from "@/actions/follows";
import { Button } from "@/components/ui/button";

type FollowButtonProps = {
  targetId: string;
  targetType: FollowTarget;
  isFollowing: boolean;
};

export function FollowButton({ targetId, targetType, isFollowing }: FollowButtonProps) {
  const t = useTranslations("publicProfile");
  const [state, formAction, pending] = useActionState(toggleFollowAction, {
    status: "idle",
    following: isFollowing,
  });

  const following = state.following ?? isFollowing;

  return (
    <form action={formAction} className="grid gap-1">
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="following" value={following ? "1" : "0"} />
      <Button
        type="submit"
        variant={following ? "outline" : "default"}
        size="sm"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : following ? (
          <Check aria-hidden="true" />
        ) : (
          <UserPlus aria-hidden="true" />
        )}
        {following ? t("unfollow") : t("follow")}
      </Button>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
