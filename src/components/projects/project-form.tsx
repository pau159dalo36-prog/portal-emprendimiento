"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save } from "lucide-react";

import { createProjectAction, updateProjectAction } from "@/actions/project";
import { initialFormState, type FormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/profile/chip-group";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INDUSTRIES, MAX_INDUSTRIES } from "@/organizations/constants";
import { PROJECT_STAGES, PROJECT_STATUSES } from "@/projects/constants";
import {
  emptyProjectFormData,
  type ProjectFormData,
} from "@/projects/map";

export type ProjectOrganizationOption = {
  id: string;
  name: string;
  slug: string;
};

type ProjectFormProps = {
  mode: "create" | "edit";
  initial?: ProjectFormData;
  projectId?: string;
  organizations?: ProjectOrganizationOption[];
};

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export function ProjectForm({
  mode,
  initial,
  projectId,
  organizations = [],
}: ProjectFormProps) {
  const t = useTranslations("projectForm");
  const industriesT = useTranslations("industries");
  const stages = useTranslations("projectStages");
  const statuses = useTranslations("projectStatuses");
  const action = mode === "create" ? createProjectAction : updateProjectAction;
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [draft, setDraft] = useState<ProjectFormData>(
    () => initial ?? emptyProjectFormData,
  );

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {mode === "edit" && projectId && (
        <input type="hidden" name="project_id" value={projectId} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">{t("nameLabel")}</Label>
          <Input
            id="name"
            name="name"
            value={draft.name}
            onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
            aria-invalid={Boolean(fieldError(state, "name"))}
            placeholder={t("namePlaceholder")}
          />
          {fieldError(state, "name") && (
            <p className="text-sm text-destructive">{fieldError(state, "name")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="slug">{t("slugLabel")}</Label>
          <Input
            id="slug"
            name="slug"
            value={draft.slug}
            onChange={(event) =>
              setDraft((d) => ({
                ...d,
                slug: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
              }))
            }
            aria-invalid={Boolean(fieldError(state, "slug"))}
            placeholder={t("slugPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">{t("slugHint")}</p>
          {fieldError(state, "slug") && (
            <p className="text-sm text-destructive">{fieldError(state, "slug")}</p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="tagline">{t("taglineLabel")}</Label>
          <Input
            id="tagline"
            name="tagline"
            value={draft.tagline}
            onChange={(event) => setDraft((d) => ({ ...d, tagline: event.target.value }))}
            aria-invalid={Boolean(fieldError(state, "tagline"))}
            placeholder={t("taglinePlaceholder")}
          />
          {fieldError(state, "tagline") && (
            <p className="text-sm text-destructive">{fieldError(state, "tagline")}</p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="description">{t("descriptionLabel")}</Label>
          <Textarea
            id="description"
            name="description"
            value={draft.description}
            onChange={(event) =>
              setDraft((d) => ({ ...d, description: event.target.value }))
            }
            aria-invalid={Boolean(fieldError(state, "description"))}
            placeholder={t("descriptionPlaceholder")}
          />
          {fieldError(state, "description") && (
            <p className="text-sm text-destructive">{fieldError(state, "description")}</p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="problem">{t("problemLabel")}</Label>
          <Textarea
            id="problem"
            name="problem"
            value={draft.problem}
            onChange={(event) => setDraft((d) => ({ ...d, problem: event.target.value }))}
            aria-invalid={Boolean(fieldError(state, "problem"))}
            placeholder={t("problemPlaceholder")}
          />
          {fieldError(state, "problem") && (
            <p className="text-sm text-destructive">{fieldError(state, "problem")}</p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="solution">{t("solutionLabel")}</Label>
          <Textarea
            id="solution"
            name="solution"
            value={draft.solution}
            onChange={(event) =>
              setDraft((d) => ({ ...d, solution: event.target.value }))
            }
            aria-invalid={Boolean(fieldError(state, "solution"))}
            placeholder={t("solutionPlaceholder")}
          />
          {fieldError(state, "solution") && (
            <p className="text-sm text-destructive">{fieldError(state, "solution")}</p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="target_market">{t("targetMarketLabel")}</Label>
          <Textarea
            id="target_market"
            name="target_market"
            value={draft.target_market}
            onChange={(event) =>
              setDraft((d) => ({ ...d, target_market: event.target.value }))
            }
            aria-invalid={Boolean(fieldError(state, "target_market"))}
            placeholder={t("targetMarketPlaceholder")}
          />
          {fieldError(state, "target_market") && (
            <p className="text-sm text-destructive">
              {fieldError(state, "target_market")}
            </p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="traction">{t("tractionLabel")}</Label>
          <Textarea
            id="traction"
            name="traction"
            value={draft.traction}
            onChange={(event) =>
              setDraft((d) => ({ ...d, traction: event.target.value }))
            }
            aria-invalid={Boolean(fieldError(state, "traction"))}
            placeholder={t("tractionPlaceholder")}
          />
          {fieldError(state, "traction") && (
            <p className="text-sm text-destructive">{fieldError(state, "traction")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stage">{t("stageLabel")}</Label>
          <select
            id="stage"
            name="stage"
            value={draft.stage}
            onChange={(event) => setDraft((d) => ({ ...d, stage: event.target.value }))}
            className={selectClassName}
          >
            {PROJECT_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stages(stage as Parameters<typeof stages>[0])}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("stageHint")}</p>
          {fieldError(state, "stage") && (
            <p className="text-sm text-destructive">{fieldError(state, "stage")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="industries">{t("industriesLabel")}</Label>
          <div className="mt-2">
            <ChipGroup
              name="industries"
              options={INDUSTRIES.map((value) => ({ value, label: industriesT(value) }))}
              value={draft.industries}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  industries: next.slice(0, MAX_INDUSTRIES),
                }))
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("industriesHint")}</p>
          {fieldError(state, "industries") && (
            <p className="text-sm text-destructive">{fieldError(state, "industries")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="website_url">{t("websiteLabel")}</Label>
          <Input
            id="website_url"
            name="website_url"
            type="url"
            value={draft.website_url}
            onChange={(event) =>
              setDraft((d) => ({ ...d, website_url: event.target.value }))
            }
            aria-invalid={Boolean(fieldError(state, "website_url"))}
            placeholder={t("websitePlaceholder")}
          />
          {fieldError(state, "website_url") && (
            <p className="text-sm text-destructive">{fieldError(state, "website_url")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="cover_image_url">{t("coverLabel")}</Label>
          <Input
            id="cover_image_url"
            name="cover_image_url"
            type="url"
            value={draft.cover_image_url}
            onChange={(event) =>
              setDraft((d) => ({ ...d, cover_image_url: event.target.value }))
            }
            aria-invalid={Boolean(fieldError(state, "cover_image_url"))}
            placeholder={t("coverPlaceholder")}
          />
          {fieldError(state, "cover_image_url") && (
            <p className="text-sm text-destructive">
              {fieldError(state, "cover_image_url")}
            </p>
          )}
        </div>

        {mode === "edit" && (
          <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
            <div className="grid gap-2">
              <Label htmlFor="organization_id">{t("organizationLabel")}</Label>
              <select
                id="organization_id"
                name="organization_id"
                value={draft.organization_id}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, organization_id: event.target.value }))
                }
                className={selectClassName}
              >
                <option value="">{t("organizationNone")}</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              {fieldError(state, "organization_id") && (
                <p className="text-sm text-destructive">
                  {fieldError(state, "organization_id")}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">{t("statusLabel")}</Label>
              <select
                id="status"
                name="status"
                value={draft.status}
                onChange={(event) => setDraft((d) => ({ ...d, status: event.target.value }))}
                className={selectClassName}
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statuses(status as Parameters<typeof statuses>[0])}
                  </option>
                ))}
              </select>
              {fieldError(state, "status") && (
                <p className="text-sm text-destructive">{fieldError(state, "status")}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <label className="flex items-center gap-3 rounded-lg border border-border p-4">
        <input
          type="checkbox"
          name="is_public"
          checked={draft.is_public}
          onChange={(event) =>
            setDraft((d) => ({ ...d, is_public: event.target.checked }))
          }
          className="size-4 rounded border-border accent-primary"
        />
        <span>
          <span className="block text-sm font-medium">{t("publicLabel")}</span>
          <span className="block text-xs text-muted-foreground">{t("publicHint")}</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <FormMessage status={state.status === "idle" ? undefined : state.status}>
          {state.status === "idle" ? undefined : state.message}
        </FormMessage>
        <Button type="submit" disabled={pending} className="ml-auto">
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {mode === "create" ? t("submitCreate") : t("submitUpdate")}
        </Button>
      </div>
    </form>
  );
}
