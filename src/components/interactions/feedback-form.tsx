"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { upsertFeedbackAction } from "@/actions/interactions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FeedbackFormProps = {
  projectId: string;
  existing: {
    understanding: string;
    problem: string | null;
    useful: string | null;
    unclear: string | null;
    suggestions: string | null;
    would_use: string;
    interest_score: number | null;
  } | null;
};

export function FeedbackForm({ projectId, existing }: FeedbackFormProps) {
  const t = useTranslations("interactions.feedback");
  const [state, formAction, pending] = useActionState(upsertFeedbackAction, {
    status: "idle",
  });

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="project_id" value={projectId} />

      <div className="grid gap-1.5">
        <Label htmlFor="feedback-understanding">{t("understanding")}</Label>
        <Textarea
          id="feedback-understanding"
          name="understanding"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          defaultValue={existing?.understanding ?? ""}
          placeholder={t("understandingPlaceholder")}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="feedback-problem">{t("problem")}</Label>
        <Textarea
          id="feedback-problem"
          name="problem"
          maxLength={2000}
          rows={2}
          defaultValue={existing?.problem ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="feedback-useful">{t("useful")}</Label>
          <Textarea
            id="feedback-useful"
            name="useful"
            maxLength={2000}
            rows={2}
            defaultValue={existing?.useful ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="feedback-unclear">{t("unclear")}</Label>
          <Textarea
            id="feedback-unclear"
            name="unclear"
            maxLength={2000}
            rows={2}
            defaultValue={existing?.unclear ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="feedback-suggestions">{t("suggestions")}</Label>
        <Textarea
          id="feedback-suggestions"
          name="suggestions"
          maxLength={2000}
          rows={2}
          defaultValue={existing?.suggestions ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-medium">{t("wouldUse")}</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {(["yes", "maybe", "no"] as const).map((option) => (
              <label key={option} className="inline-flex items-center gap-1.5">
                <Input
                  type="radio"
                  name="would_use"
                  value={option}
                  defaultChecked={(existing?.would_use ?? "maybe") === option}
                  className="size-4"
                />
                {t(`wouldUse_${option}` as FeedbackWouldUseKey)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="feedback-interest">{t("interestScore")}</Label>
          <Input
            id="feedback-interest"
            name="interest_score"
            type="number"
            min={0}
            max={10}
            step={1}
            defaultValue={existing?.interest_score ?? ""}
            placeholder={t("interestScorePlaceholder")}
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">{t("interestScoreHint")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : existing ? t("update") : t("submit")}
        </Button>
        {state.status === "success" && state.message ? (
          <FormMessage status="success">{state.message}</FormMessage>
        ) : null}
        {state.status === "error" && state.message ? (
          <FormMessage status="error">{state.message}</FormMessage>
        ) : null}
      </div>
    </form>
  );
}

type FeedbackWouldUseKey = `wouldUse_${"yes" | "no" | "maybe"}`;
