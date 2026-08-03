"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save } from "lucide-react";

import {
  createOrganizationAction,
  updateOrganizationAction,
} from "@/actions/organization";
import { initialFormState, type FormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/profile/chip-group";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INDUSTRIES, MAX_INDUSTRIES } from "@/organizations/constants";
import {
  emptyOrganizationFormData,
  type OrganizationFormData,
} from "@/organizations/map";

type OrganizationFormProps = {
  mode: "create" | "edit";
  initial?: OrganizationFormData;
  organizationId?: string;
};

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

export function OrganizationForm({
  mode,
  initial,
  organizationId,
}: OrganizationFormProps) {
  const t = useTranslations("organizationForm");
  const industriesT = useTranslations("industries");
  const action = mode === "create" ? createOrganizationAction : updateOrganizationAction;
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [draft, setDraft] = useState<OrganizationFormData>(
    () => initial ?? emptyOrganizationFormData,
  );

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {mode === "edit" && organizationId && (
        <input type="hidden" name="organization_id" value={organizationId} />
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
          <Label htmlFor="headline">{t("headlineLabel")}</Label>
          <Input
            id="headline"
            name="headline"
            value={draft.headline}
            onChange={(event) => setDraft((d) => ({ ...d, headline: event.target.value }))}
            aria-invalid={Boolean(fieldError(state, "headline"))}
            placeholder={t("headlinePlaceholder")}
          />
          {fieldError(state, "headline") && (
            <p className="text-sm text-destructive">{fieldError(state, "headline")}</p>
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
          <Label htmlFor="location">{t("locationLabel")}</Label>
          <Input
            id="location"
            name="location"
            value={draft.location}
            onChange={(event) => setDraft((d) => ({ ...d, location: event.target.value }))}
            aria-invalid={Boolean(fieldError(state, "location"))}
            placeholder={t("locationPlaceholder")}
          />
          {fieldError(state, "location") && (
            <p className="text-sm text-destructive">{fieldError(state, "location")}</p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <span className="text-sm leading-none font-medium">{t("industriesLabel")}</span>
          <p className="text-sm text-muted-foreground">
            {t("industriesHint")}
          </p>
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
          {fieldError(state, "industries") && (
            <p className="text-sm text-destructive">{fieldError(state, "industries")}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <Label htmlFor="contact_email">{t("contactEmailLabel")}</Label>
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            value={draft.contact_email}
            onChange={(event) =>
              setDraft((d) => ({ ...d, contact_email: event.target.value }))
            }
            aria-invalid={Boolean(fieldError(state, "contact_email"))}
            placeholder={t("contactEmailPlaceholder")}
          />
          {fieldError(state, "contact_email") && (
            <p className="text-sm text-destructive">{fieldError(state, "contact_email")}</p>
          )}
        </div>
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
