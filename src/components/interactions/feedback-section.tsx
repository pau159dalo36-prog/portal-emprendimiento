import { getTranslations } from "next-intl/server";
import { MessageSquareHeart } from "lucide-react";

import { getCurrentUser } from "@/auth/session";
import { FeedbackForm } from "@/components/interactions/feedback-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyProjectFeedback, getProjectFeedbackCount } from "@/interactions/feedback";

type FeedbackSectionProps = {
  projectId: string;
  isOwner: boolean;
};

// Sección de feedback estructurado en la página pública del proyecto.
// - Anónimo: ve el contador agregado (RPC, sin datos de terceros).
// - Usuario no propietario: formulario (1 feedback por usuario, actualizable).
// - Propietario: solo lectura del contador (los detalles los verá en su panel).
export async function FeedbackSection({ projectId, isOwner }: FeedbackSectionProps) {
  const t = await getTranslations("interactions.feedback");
  const { supabase, user } = await getCurrentUser();
  const feedbackCount = await getProjectFeedbackCount(supabase, projectId);

  const canGiveFeedback = !!user && !isOwner;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareHeart className="size-4" aria-hidden="true" />
          {t("title", { count: feedbackCount })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!user ? (
          <p className="text-sm text-muted-foreground">{t("signInToGive")}</p>
        ) : canGiveFeedback ? (
          <FeedbackFormWrapper
            supabase={supabase}
            projectId={projectId}
            userId={user.id}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("ownerHint")}</p>
        )}
      </CardContent>
    </Card>
  );
}

async function FeedbackFormWrapper({
  supabase,
  projectId,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"];
  projectId: string;
  userId: string;
}) {
  const t = await getTranslations("interactions.feedback");
  const existing = await getMyProjectFeedback(supabase, projectId, userId);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {existing ? t("updateHint") : t("createHint")}
      </p>
      <FeedbackForm
        projectId={projectId}
        existing={
          existing && {
            understanding: existing.understanding,
            problem: existing.problem,
            useful: existing.useful,
            unclear: existing.unclear,
            suggestions: existing.suggestions,
            would_use: existing.would_use,
            interest_score: existing.interest_score,
          }
        }
      />
    </div>
  );
}
