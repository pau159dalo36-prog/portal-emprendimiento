"use client";

import * as React from "react";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { saveOnboardingStepAction } from "@/actions/profile";
import { initialFormState, type FormState } from "@/actions/form-state";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

export type OnboardingInitialProfile = {
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

type OnboardingFormProps = {
  initialProfile: OnboardingInitialProfile;
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

const TOTAL_STEPS = 5;

function draftFromProfile(
  initialProfile: OnboardingInitialProfile,
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

function StepForm({
  step,
  children,
  onSuccess,
}: {
  step: number;
  children: (state: FormState, pending: boolean) => React.ReactNode;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveOnboardingStepAction, initialFormState);
  const handledSuccess = React.useRef<number | null>(null);

  useEffect(() => {
    if (
      state.status === "success" &&
      state.savedStep === step &&
      handledSuccess.current !== state.savedStep
    ) {
      handledSuccess.current = state.savedStep;
      onSuccess();
    }
  }, [state, step, onSuccess]);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="step" value={step} />
      {children(state, pending)}
    </form>
  );
}

export function OnboardingForm({
  initialProfile,
  skills,
  initialSkills,
  initialInterests,
}: OnboardingFormProps) {
  const t = useTranslations("onboarding");
  const types = useTranslations("types");
  const collab = useTranslations("collab");
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromProfile(initialProfile, initialSkills, initialInterests),
  );

  function advance() {
    setStep((current) => Math.min(current + 1, TOTAL_STEPS));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 1));
  }

  return (
    <div>
      <nav aria-label={t("navLabel")} className="mb-6">
        <ol className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map(
            (stepNumber, index) => {
              const completed = stepNumber < step;
              const current = stepNumber === step;
              return (
                <li key={stepNumber} className="flex items-center gap-2">
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className={cn("h-px w-6", completed ? "bg-primary" : "bg-border")}
                    />
                  )}
                  <span
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium",
                      completed && "text-primary",
                      current && "text-foreground",
                      !completed && !current && "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                        completed && "border-primary bg-primary text-primary-foreground",
                        current && "border-primary text-primary",
                        !completed && !current && "border-border text-muted-foreground",
                      )}
                    >
                      {completed ? <Check className="size-3" aria-hidden="true" /> : stepNumber}
                    </span>
                    <span className="hidden sm:inline">
                      {t(`steps.${stepNumber}`)}
                    </span>
                  </span>
                </li>
              );
            },
          )}
        </ol>
      </nav>

      <div className="mb-6">
        <p className="mb-2 text-sm text-muted-foreground">
          {t("stepCount", { current: step, total: TOTAL_STEPS })}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {step === 1 && (
        <StepForm step={1} onSuccess={advance}>
          {(state, pending) => (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{t("step1.title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("step1.description")}</p>
              </div>

              <div>
                <span className="text-sm leading-none font-medium">{t("fields.photoLabel")}</span>
                <p className="mt-1 text-sm text-muted-foreground">{t("fields.photoHint")}</p>
                <div className="mt-3">
                  <AvatarUploader name={draft.full_name} src={initialProfile.avatar_url} />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="full_name">{t("fields.fullName")}</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    value={draft.full_name}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, full_name: event.target.value }))
                    }
                    aria-invalid={Boolean(fieldError(state, "full_name"))}
                    placeholder={t("fields.fullNamePlaceholder")}
                  />
                  {fieldError(state, "full_name") && (
                    <p className="text-sm text-destructive">{fieldError(state, "full_name")}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="username">{t("fields.username")}</Label>
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
                  <p className="text-xs text-muted-foreground">{t("fields.usernameHint")}</p>
                  {fieldError(state, "username") && (
                    <p className="text-sm text-destructive">{fieldError(state, "username")}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="headline">{t("fields.headline")}</Label>
                  <Input
                    id="headline"
                    name="headline"
                    value={draft.headline}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, headline: event.target.value }))
                    }
                    aria-invalid={Boolean(fieldError(state, "headline"))}
                    placeholder={t("fields.headlinePlaceholder")}
                  />
                  {fieldError(state, "headline") && (
                    <p className="text-sm text-destructive">{fieldError(state, "headline")}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="location">{t("fields.location")}</Label>
                  <Input
                    id="location"
                    name="location"
                    value={draft.location}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, location: event.target.value }))
                    }
                    aria-invalid={Boolean(fieldError(state, "location"))}
                    placeholder={t("fields.locationPlaceholder")}
                  />
                  {fieldError(state, "location") && (
                    <p className="text-sm text-destructive">{fieldError(state, "location")}</p>
                  )}
                </div>
              </div>

              <FormActions
                step={step}
                pending={pending}
                canGoBack={false}
                onGoBack={goBack}
                error={state.status === "error" ? state.message : undefined}
              />
            </div>
          )}
        </StepForm>
      )}

      {step === 2 && (
        <StepForm step={2} onSuccess={advance}>
          {(state, pending) => (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{t("step2.title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("step2.description")}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bio">{t("fields.bio")}</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={draft.bio}
                  onChange={(event) => setDraft((d) => ({ ...d, bio: event.target.value }))}
                  placeholder={t("fields.bioPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("fields.charCount", { count: draft.bio.length, max: 1000 })}
                </p>
              </div>

              <FormActions
                step={step}
                pending={pending}
                canGoBack={true}
                onGoBack={goBack}
                error={state.status === "error" ? state.message : undefined}
              />
            </div>
          )}
        </StepForm>
      )}

      {step === 3 && (
        <StepForm step={3} onSuccess={advance}>
          {(state, pending) => (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{t("step3.title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("step3.description")}</p>
              </div>

              <div className="grid gap-3">
                <div>
                  <span className="text-sm leading-none font-medium">{t("fields.userTypeLabel")}</span>
                  <p className="mt-1 text-sm text-muted-foreground">{t("fields.multipleHint")}</p>
                  <div className="mt-3">
                    <ChipGroup
                      name="user_types"
                      options={USER_TYPES.map((value) => ({
                        value,
                        label: types(value),
                      }))}
                      value={draft.user_types}
                      onChange={(next) => setDraft((d) => ({ ...d, user_types: next }))}
                    />
                  </div>
                </div>

                <div className="grid gap-2 pt-2">
                  <Label htmlFor="weekly_availability">
                    {t("fields.availabilityLabel")}
                  </Label>
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
                        setDraft((d) => ({
                          ...d,
                          weekly_availability: event.target.value,
                        }))
                      }
                      className="max-w-28"
                      placeholder={t("fields.availabilityPlaceholder")}
                    />
                    <span className="text-sm text-muted-foreground">
                      {t("fields.hoursRange", { max: MAX_AVAILABILITY })}
                    </span>
                  </div>
                  {fieldError(state, "weekly_availability") && (
                    <p className="text-sm text-destructive">
                      {fieldError(state, "weekly_availability")}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <span className="text-sm leading-none font-medium">
                    {t("fields.collabLabel")}
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">{t("fields.collabHint")}</p>
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
              </div>

              <FormActions
                step={step}
                pending={pending}
                canGoBack={true}
                onGoBack={goBack}
                error={state.status === "error" ? state.message : undefined}
              />
            </div>
          )}
        </StepForm>
      )}

      {step === 4 && (
        <StepForm step={4} onSuccess={advance}>
          {(state, pending) => (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{t("step4.title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("step4.description")}</p>
              </div>

              <div className="grid gap-5">
                <div>
                  <span className="text-sm leading-none font-medium">{t("fields.skillsLabel")}</span>
                  <p className="mt-1 text-sm text-muted-foreground">{t("fields.skillsHint")}</p>
                  <div className="mt-3">
                    <SkillSelector
                      skills={skills}
                      value={draft.habilidades}
                      onChange={(next) => setDraft((d) => ({ ...d, habilidades: next }))}
                    />
                  </div>
                </div>

                <div>
                  <span className="text-sm leading-none font-medium">{t("fields.interestsLabel")}</span>
                  <p className="mt-1 text-sm text-muted-foreground">{t("fields.interestsHint")}</p>
                  <div className="mt-3">
                    <InterestInput
                      value={draft.intereses}
                      onChange={(next) => setDraft((d) => ({ ...d, intereses: next }))}
                    />
                  </div>
                </div>
              </div>

              <FormActions
                step={step}
                pending={pending}
                canGoBack={true}
                onGoBack={goBack}
                error={state.status === "error" ? state.message : undefined}
              />
            </div>
          )}
        </StepForm>
      )}

      {step === 5 && (
        <StepForm step={5} onSuccess={advance}>
          {(state, pending) => (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{t("step5.title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("step5.description")}</p>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="website_url">{t("fields.websiteLabel")}</Label>
                  <Input
                    id="website_url"
                    name="website_url"
                    value={draft.website_url}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, website_url: event.target.value }))
                    }
                    aria-invalid={Boolean(fieldError(state, "website_url"))}
                    placeholder={t("fields.websitePlaceholder")}
                  />
                  {fieldError(state, "website_url") && (
                    <p className="text-sm text-destructive">{fieldError(state, "website_url")}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="linkedin_url">{t("fields.linkedinLabel")}</Label>
                  <Input
                    id="linkedin_url"
                    name="linkedin_url"
                    value={draft.linkedin_url}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, linkedin_url: event.target.value }))
                    }
                    aria-invalid={Boolean(fieldError(state, "linkedin_url"))}
                    placeholder={t("fields.linkedinPlaceholder")}
                  />
                  {fieldError(state, "linkedin_url") && (
                    <p className="text-sm text-destructive">{fieldError(state, "linkedin_url")}</p>
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
                    <span className="block text-sm font-medium">{t("fields.publicLabel")}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("fields.publicHint")}
                    </span>
                  </span>
                </label>
              </div>

              <FormActions
                step={step}
                pending={pending}
                canGoBack={true}
                onGoBack={goBack}
                last={true}
                error={state.status === "error" ? state.message : undefined}
              />
            </div>
          )}
        </StepForm>
      )}
    </div>
  );
}

function FormActions({
  step,
  pending,
  canGoBack,
  onGoBack,
  last,
  error,
}: {
  step: number;
  pending: boolean;
  canGoBack: boolean;
  onGoBack: () => void;
  last?: boolean;
  error?: string;
}) {
  const t = useTranslations("onboarding");

  return (
    <div className="space-y-3 pt-2">
      {error && (
        <FormMessage status="error">
          {error}
        </FormMessage>
      )}
      <div className="flex items-center justify-between gap-3">
        {canGoBack ? (
          <Button type="button" variant="outline" onClick={onGoBack} disabled={pending}>
            <ArrowLeft aria-hidden="true" />
            {t("actions.back")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <>
              {last ? t("actions.finish") : t("actions.continue")}
              {!last && <ArrowRight aria-hidden="true" />}
            </>
          )}
        </Button>
      </div>
      {last && (
        <p className="text-xs text-muted-foreground">
          {t("actions.lastHint", { step, total: TOTAL_STEPS })}
        </p>
      )}
    </div>
  );
}
