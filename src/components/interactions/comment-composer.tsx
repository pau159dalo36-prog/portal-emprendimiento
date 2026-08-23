"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { createCommentAction } from "@/actions/interactions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CommentComposerProps = {
  postId: string;
  parentId?: string;
  compact?: boolean;
};

export function CommentComposer({ postId, parentId, compact }: CommentComposerProps) {
  const t = useTranslations("interactions.comments");
  const [state, formAction] = useActionState(createCommentAction, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-2">
      <input type="hidden" name="post_id" value={postId} />
      {parentId ? <input type="hidden" name="parent_id" value={parentId} /> : null}
      <div className="grid gap-1.5">
        <Label htmlFor={parentId ? `reply-body-${parentId}` : "comment-body"} className="sr-only">
          {t("bodyLabel")}
        </Label>
        <Textarea
          id={parentId ? `reply-body-${parentId}` : "comment-body"}
          name="body"
          required
          maxLength={2000}
          rows={compact ? 2 : 3}
          placeholder={compact ? t("replyPlaceholder") : t("placeholder")}
          aria-label={t("bodyLabel")}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">
          {t(compact ? "submitReply" : "submit")}
        </Button>
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-xs text-destructive">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
