import { getTranslations } from "next-intl/server";
import { MessageSquare } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import {
  CommentActions,
} from "@/components/interactions/comment-actions";
import { CommentComposer } from "@/components/interactions/comment-composer";
import { Avatar } from "@/components/ui/avatar";
import { listCommentsForPost } from "@/interactions/comments";

type CommentSectionProps = {
  postId: string;
  commentCount: number;
};

// Render de hilo a 1 nivel: raíces + sus respuestas directas. La RLS ya
// filtra comentarios ocultos o de contenido no accesible.
export async function CommentSection({ postId, commentCount }: CommentSectionProps) {
  const t = await getTranslations("interactions.comments");
  const dateFormatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  });

  const { supabase, user } = await getCurrentUser();
  const comments = await listCommentsForPost(supabase, postId);

  const roots = comments.filter((comment) => comment.parent_id === null);
  const repliesByParent = new Map<string, typeof comments>();
  for (const comment of comments) {
    if (comment.parent_id) {
      repliesByParent.set(comment.parent_id, [
        ...(repliesByParent.get(comment.parent_id) ?? []),
        comment,
      ]);
    }
  }

  return (
    <section aria-label={t("sectionLabel")} className="grid gap-4 rounded-2xl border border-border p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <MessageSquare className="size-4" aria-hidden="true" />
        {t("title", { count: commentCount })}
      </h2>

      {user ? (
        <CommentComposer postId={postId} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("signInToComment")}</p>
      )}

      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="grid gap-5">
          {roots.map((root) => {
            const replies = repliesByParent.get(root.id) ?? [];
            return (
              <li key={root.id} className="grid gap-3">
                <CommentBody
                  comment={root}
                  dateFormatter={dateFormatter}
                  isOwn={user?.id === root.author_id}
                />
                {replies.length > 0 && (
                  <ul className="ml-4 grid gap-3 border-l border-border pl-4 sm:ml-8 sm:pl-6">
                    {replies.map((reply) => (
                      <li key={reply.id}>
                        <CommentBody
                          comment={reply}
                          dateFormatter={dateFormatter}
                          isOwn={user?.id === reply.author_id}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {user && (
                  <details className="group ml-4 sm:ml-8">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                      {t("reply")}
                    </summary>
                    <div className="mt-2">
                      <CommentComposer postId={postId} parentId={root.id} compact />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type CommentBodyProps = {
  comment: Awaited<ReturnType<typeof listCommentsForPost>>[number];
  dateFormatter: Intl.DateTimeFormat;
  isOwn: boolean;
};

function CommentBody({ comment, dateFormatter, isOwn }: CommentBodyProps) {
  const author = comment.author;

  return (
    <article className="flex items-start gap-3">
      <Avatar name={author?.full_name ?? undefined} src={author?.avatar_url ?? undefined} size="sm" />
      <div className="min-w-0 flex-1 grid gap-1">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium">
            {author?.full_name ?? (author?.username ? `@${author.username}` : "—")}
          </span>
          <time dateTime={comment.created_at} className="text-xs text-muted-foreground">
            {dateFormatter.format(new Date(comment.created_at))}
          </time>
        </header>
        <p className="whitespace-pre-line break-words text-sm text-foreground/90">{comment.body}</p>
        {isOwn && <CommentActions commentId={comment.id} body={comment.body} />}
      </div>
    </article>
  );
}
