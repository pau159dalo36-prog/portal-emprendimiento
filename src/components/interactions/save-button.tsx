"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

import { toggleSaveAction } from "@/actions/interactions";
import type { SaveTarget } from "@/config/interactions";
import { Button } from "@/components/ui/button";

type SaveButtonProps = {
  targetId: string;
  targetType: SaveTarget;
  saved: boolean;
};

export function SaveButton({ targetId, targetType, saved }: SaveButtonProps) {
  const t = useTranslations("interactions.saves");
  const [state, formAction, pending] = useActionState(toggleSaveAction, {
    status: "idle",
    saved,
  });

  const isSaved = state.saved ?? saved;

  return (
    <form action={formAction} className="inline-flex">
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-pressed={isSaved}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : isSaved ? (
          <BookmarkCheck className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <Bookmark className="size-4" aria-hidden="true" />
        )}
        {isSaved ? t("saved") : t("save")}
      </Button>
      {state.status === "error" && state.message ? (
        <p role="alert" className="sr-only">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
