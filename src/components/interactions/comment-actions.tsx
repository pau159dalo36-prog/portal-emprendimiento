"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { EyeOff, Loader2, Pencil, Trash2 } from "lucide-react";

import {
  deleteCommentAction,
  hideCommentAction,
  updateCommentAction,
} from "@/actions/interactions";
import type { FormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type CommentActionsProps = {
  commentId: string;
  body: string;
};

export function CommentActions({ commentId, body }: CommentActionsProps) {
  const t = useTranslations("interactions.comments");
  const [editing, setEditing] = useState(false);
  const [updateState, updateFormAction, updatePending] = useActionState(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await updateCommentAction(prevState, formData);
      // Cerramos el editor al tener éxito (contexto de acción, no de efecto).
      if (result.status === "success") {
        setEditing(false);
      }
      return result;
    },
    { status: "idle" },
  );
  const [hideState, hideFormAction, hidePending] = useActionState(hideCommentAction, {
    status: "idle",
  });
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteCommentAction, {
    status: "idle",
  });
  const formRef = useRef<HTMLFormElement>(null);

  const error =
    (updateState.status === "error" && updateState.message) ||
    (hideState.status === "error" && hideState.message) ||
    (deleteState.status === "error" && deleteState.message) ||
    null;

  if (editing) {
    return (
      <form ref={formRef} action={updateFormAction} className="grid w-full gap-2">
        <input type="hidden" name="comment_id" value={commentId} />
        <Textarea name="body" defaultValue={body} required maxLength={2000} rows={3} />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={updatePending}>
            {updatePending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {t("saveEdit")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            {t("cancelEdit")}
          </Button>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" aria-hidden="true" />
        {t("edit")}
      </Button>

      <form action={hideFormAction}>
        <input type="hidden" name="comment_id" value={commentId} />
        <Button type="submit" size="sm" variant="ghost" disabled={hidePending}>
          {hidePending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <EyeOff className="size-3.5" aria-hidden="true" />
          )}
          {t("hide")}
        </Button>
      </form>

      <form action={deleteFormAction}>
        <input type="hidden" name="comment_id" value={commentId} />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          disabled={deletePending}
          className="text-destructive hover:text-destructive"
        >
          {deletePending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="size-3.5" aria-hidden="true" />
          )}
          {t("delete")}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
