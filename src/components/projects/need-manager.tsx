"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { initialFormState, type FormState } from "@/actions/form-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NEED_STATUSES } from "@/projects/constants";

export type NeedManagerItem = {
  id: string;
  title: string;
  description: string | null;
  commitment: string | null;
  status: string;
};

type NeedManagerProps = {
  needs: NeedManagerItem[];
  addAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  updateStatusAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  projectId: string;
  canManage: boolean;
};

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

export function NeedManager({
  needs,
  addAction,
  updateStatusAction,
  removeAction,
  projectId,
  canManage,
}: NeedManagerProps) {
  const t = useTranslations("managers");
  const statuses = useTranslations("needStatuses");
  const [state, formAction, pending] = useActionState(addAction, initialFormState);

  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">{t("needsTitle")}</h2>

      {needs.length > 0 ? (
        <ul className="grid gap-2">
          {needs.map((need) => (
            <li
              key={need.id}
              className="grid gap-2 rounded-lg border border-border px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{need.title}</p>
                  {need.commitment && (
                    <p className="text-xs text-muted-foreground">{need.commitment}</p>
                  )}
                </div>
                {canManage ? (
                  <form action={updateStatusAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="need_id" value={need.id} />
                    <select
                      name="status"
                      defaultValue={need.status}
                      aria-label={t("status")}
                      className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      {NEED_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statuses(status as Parameters<typeof statuses>[0])}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">
                      {t("update")}
                    </Button>
                    <Button type="submit" formAction={removeAction} size="sm" variant="destructive">
                      {t("remove")}
                    </Button>
                  </form>
                ) : (
                  <Badge
                    className={
                      need.status === "open"
                        ? "border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border bg-muted text-muted-foreground"
                    }
                  >
                    {statuses(need.status as Parameters<typeof statuses>[0])}
                  </Badge>
                )}
              </div>
              {need.description && (
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {need.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noNeeds")}</p>
      )}

      {canManage && (
        <form
          action={formAction}
          noValidate
          className="grid gap-2 rounded-lg border border-dashed border-border p-4"
        >
          <input type="hidden" name="project_id" value={projectId} />
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="need-title">{t("needTitle")}</Label>
              <Input
                id="need-title"
                name="title"
                placeholder={t("needTitlePlaceholder")}
                aria-invalid={Boolean(fieldError(state, "title"))}
              />
              {fieldError(state, "title") && (
                <p className="text-sm text-destructive">{fieldError(state, "title")}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="need-description">{t("needDescription")}</Label>
              <Textarea
                id="need-description"
                name="description"
                placeholder={t("needDescriptionPlaceholder")}
                aria-invalid={Boolean(fieldError(state, "description"))}
              />
              {fieldError(state, "description") && (
                <p className="text-sm text-destructive">
                  {fieldError(state, "description")}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="need-commitment">{t("needCommitment")}</Label>
              <Input
                id="need-commitment"
                name="commitment"
                placeholder={t("needCommitmentPlaceholder")}
                aria-invalid={Boolean(fieldError(state, "commitment"))}
                className="max-w-64"
              />
              {fieldError(state, "commitment") && (
                <p className="text-sm text-destructive">
                  {fieldError(state, "commitment")}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FormMessage status={state.status === "idle" ? undefined : state.status}>
              {state.status === "idle" ? undefined : state.message}
            </FormMessage>
            <Button type="submit" disabled={pending} className="ml-auto">
              <Plus aria-hidden="true" />
              {t("addNeedSubmit")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
