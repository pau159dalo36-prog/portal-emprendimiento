"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save } from "lucide-react";

import { updateProfileAction } from "@/actions/profile";
import { initialFormState, type FormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ChipGroup } from "@/components/profile/chip-group";
import { InterestInput } from "@/components/profile/interest-input";
import {
  SkillSelector,
  type SkillOption,
  type SkillSelection,
} from "@/components/profile/skill-selector";
import {
  COLLABORATION_PREFERENCES,
  MAX_AVAILABILITY,
  USER_TYPES,
} from "@/profiles/constants";

export type ProfileFormData = {
  full_name: string | null;
  username: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  user_types: string[];
  weekly_availability: number | null;
  collaboration_preferences: string[];
  website_url: string | null;
  linkedin_url: string | null;
  is_public: boolean;
  avatar_url: string | null;
};

type ProfileFormProps = {
  initialProfile: ProfileFormData;
  skills: SkillOption[];
  initialSkills: SkillSelection;
  initialInterests: string[];
};

type Draft = {
  full_name: string;
  username: string;
  headline: string;
  bio: string;
  location: string;
  user_types: string[];
  weekly_availability: string;
  collaboration_preferences: string[];
  habilidades: SkillSelection;
  intereses: string[];
  website_url: string;
  linkedin_url: string;
  is_public: boolean;
};

function draftFromProfile(
  initialProfile: ProfileFormData,
  initialSkills: SkillSelection,
  initialInterests: string[],
): Draft {
  return {
    full_name: initialProfile.full_name ?? "",
    username: initialProfile.username ?? "",
    headline: initialProfile.headline ?? "",
    bio: initialProfile.bio ?? "",
    location: initialProfile.location ?? "",
    user_types: initialProfile.user_types,
    weekly_availability:
      initialProfile.weekly_availability != null
        ? String(initialProfile.weekly_availability)
        : "",
    collaboration_preferences: initialProfile.collaboration_preferences,
    habilidades: initialSkills,
    intereses: initialInterests,
    website_url: initialProfile.website_url ?? "",
    linkedin_url: initialProfile.linkedin_url ?? "",
    is_public: initialProfile.is_public,
  };
}

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

export function ProfileForm({
  initialProfile,
  skills,
  initialSkills,
  initialInterests,
}: ProfileFormProps) {
  const t = useTranslations("profileForm");
  const f = useTranslations("profileFields");
  const types = useTranslations("types");
  const collab = useTranslations("collab");
  const [state, formAction, pending] = useActionState(updateProfileAction, initialFormState);
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromProfile(initialProfile, initialSkills, initialInterests),
  );

  return (
    <form action={formAction} noValidate className="space-y-8">
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("photoTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("photoHint")}</p>
        </div>
        <AvatarUploader name={initialProfile.full_name} src={initialProfile.avatar_url} />
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">{t("basicTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("basicHint")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="full_name">{f("fullName")}</Label>
            <Input
              id="full_name"
              name="full_name"
              value={draft.full_name}
              onChange={(event) =>
                setDraft((d) => ({ ...d, full_name: event.target.value }))
              }
              aria-invalid={Boolean(fieldError(state, "full_name"))}
              placeholder={f("fullNamePlaceholder")}
            />
            {fieldError(state, "full_name") && (
              <p className="text-sm text-destructive">{fieldError(state, "full_name")}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="username">{f("username")}</Label>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/40 px-3">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="username"
                name="username"
                value={draft.username}
                onChange={(event) =>
                  setDraft((d) => ({
                    ...d,
                    username: event.target.value.replace(/[^a-z0-9_-]/gi, ""),
                  }))
                }
                aria-invalid={Boolean(fieldError(state, "username"))}
                placeholder="maria-garcia"
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <p className="text-xs text-muted-foreground">{f("usernameHint")}</p>
            {fieldError(state, "username") && (
              <p className="text-sm text-destructive">{fieldError(state, "username")}</p>
            )}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="headline">{f("headline")}</Label>
            <Input
              id="headline"
              name="headline"
              value={draft.headline}
              onChange={(event) => setDraft((d) => ({ ...d, headline: event.target.value }))}
              aria-invalid={Boolean(fieldError(state, "headline"))}
              placeholder={f("headlinePlaceholder")}
            />
            {fieldError(state, "headline") && (
              <p className="text-sm text-destructive">{fieldError(state, "headline")}</p>
            )}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="location">{f("location")}</Label>
            <Input
              id="location"
              name="location"
              value={draft.location}
              onChange={(event) => setDraft((d) => ({ ...d, location: event.target.value }))}
              aria-invalid={Boolean(fieldError(state, "location"))}
              placeholder={f("locationPlaceholder")}
            />
            {fieldError(state, "location") && (
              <p className="text-sm text-destructive">{fieldError(state, "location")}</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">{t("bioTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("bioHint")}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="bio">{f("bio")}</Label>
          <Textarea
            id="bio"
            name="bio"
            value={draft.bio}
            onChange={(event) => setDraft((d) => ({ ...d, bio: event.target.value }))}
            placeholder={f("bioPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">{f("charCount", { count: draft.bio.length, max: 1000 })}</p>
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">{t("professionalTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("professionalHint")}</p>
        </div>

        <div>
          <span className="text-sm leading-none font-medium">{f("userTypeLabel")}</span>
          <p className="mt-1 text-sm text-muted-foreground">{f("multipleHint")}</p>
          <div className="mt-3">
            <ChipGroup
              name="user_types"
              options={USER_TYPES.map((value) => ({ value, label: types(value) }))}
              value={draft.user_types}
              onChange={(next) => setDraft((d) => ({ ...d, user_types: next }))}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="weekly_availability">{f("availabilityLabel")}</Label>
          <div className="flex items-center gap-3">
            <Input
              id="weekly_availability"
              name="weekly_availability"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_AVAILABILITY}
              value={draft.weekly_availability}
              onChange={(event) =>
                setDraft((d) => ({ ...d, weekly_availability: event.target.value }))
              }
              className="max-w-28"
              placeholder={f("availabilityPlaceholder")}
            />
            <span className="text-sm text-muted-foreground">
              {f("hoursRange", { max: MAX_AVAILABILITY })}
            </span>
          </div>
          {fieldError(state, "weekly_availability") && (
            <p className="text-sm text-destructive">
              {fieldError(state, "weekly_availability")}
            </p>
          )}
        </div>

        <div>
          <span className="text-sm leading-none font-medium">{f("collabLabel")}</span>
          <p className="mt-1 text-sm text-muted-foreground">{f("collabHint")}</p>
          <div className="mt-3">
            <ChipGroup
              name="collaboration_preferences"
              options={COLLABORATION_PREFERENCES.map((value) => ({
                value,
                label: collab(value),
              }))}
              value={draft.collaboration_preferences}
              onChange={(next) =>
                setDraft((d) => ({ ...d, collaboration_preferences: next }))
              }
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">{t("skillsTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("skillsHint")}</p>
        </div>

        <div>
          <span className="text-sm leading-none font-medium">{f("skillsLabel")}</span>
          <p className="mt-1 text-sm text-muted-foreground">{f("skillsHint")}</p>
          <div className="mt-3">
            <SkillSelector
              skills={skills}
              value={draft.habilidades}
              onChange={(next) => setDraft((d) => ({ ...d, habilidades: next }))}
            />
          </div>
        </div>

        <div>
          <span className="text-sm leading-none font-medium">{f("interestsLabel")}</span>
          <p className="mt-1 text-sm text-muted-foreground">{f("interestsHint")}</p>
          <div className="mt-3">
            <InterestInput
              value={draft.intereses}
              onChange={(next) => setDraft((d) => ({ ...d, intereses: next }))}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">{t("linksTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("linksHint")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="website_url">{f("websiteLabel")}</Label>
            <Input
              id="website_url"
              name="website_url"
              value={draft.website_url}
              onChange={(event) =>
                setDraft((d) => ({ ...d, website_url: event.target.value }))
              }
              aria-invalid={Boolean(fieldError(state, "website_url"))}
              placeholder={f("websitePlaceholder")}
            />
            {fieldError(state, "website_url") && (
              <p className="text-sm text-destructive">{fieldError(state, "website_url")}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="linkedin_url">{f("linkedinLabel")}</Label>
            <Input
              id="linkedin_url"
              name="linkedin_url"
              value={draft.linkedin_url}
              onChange={(event) =>
                setDraft((d) => ({ ...d, linkedin_url: event.target.value }))
              }
              aria-invalid={Boolean(fieldError(state, "linkedin_url"))}
              placeholder={f("linkedinPlaceholder")}
            />
            {fieldError(state, "linkedin_url") && (
              <p className="text-sm text-destructive">{fieldError(state, "linkedin_url")}</p>
            )}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-border p-4">
          <input
            type="checkbox"
            name="is_public"
            checked={draft.is_public}
            onChange={(event) => setDraft((d) => ({ ...d, is_public: event.target.checked }))}
            className="size-4 rounded border-border accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">{f("publicLabel")}</span>
            <span className="block text-xs text-muted-foreground">{f("publicHint")}</span>
          </span>
        </label>
      </section>

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
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
