"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Loader2 } from "lucide-react";

import { toggleSupportAction } from "@/actions/interactions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SupportButtonProps = {
  postId: string;
  supported: boolean;
  count: number;
};

export function SupportButton({ postId, supported, count }: SupportButtonProps) {
  const t = useTranslations("interactions.reactions");
  const [state, formAction, pending] = useActionState(toggleSupportAction, {
    status: "idle",
    supported,
  });

  const isSupported = state.supported ?? supported;
  const shownCount = Math.max(0, count + (state.status === "success" ? (isSupported ? 1 : 0) - (supported ? 1 : 0) : 0));

  return (
    <form action={formAction} className="inline-flex">
      <input type="hidden" name="post_id" value={postId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-pressed={isSupported}
        className={cn(isSupported && "border-primary/40 bg-primary/10 text-primary")}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Heart className={cn("size-4", isSupported && "fill-current")} aria-hidden="true" />
        )}
        {t("support")}
        <span className="tabular-nums text-muted-foreground">{shownCount}</span>
      </Button>
      {state.status === "error" && state.message ? (
        <p role="alert" className="sr-only">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
