"use client";

import { useActionState, useState } from "react";
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
  COLLABORATION_PREFERENCE_LABELS,
  MAX_AVAILABILITY,
  USER_TYPES,
  USER_TYPE_LABELS,
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
  const [state, formAction, pending] = useActionState(updateProfileAction, initialFormState);
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromProfile(initialProfile, initialSkills, initialInterests),
  );

  return (
    <form action={formAction} noValidate className="space-y-8">
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">Foto de perfil</h2>
          <p className="text-sm text-muted-foreground">Se guarda al instante al subirla.</p>
        </div>
        <AvatarUploader name={initialProfile.full_name} src={initialProfile.avatar_url} />
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">Datos básicos</h2>
          <p className="text-sm text-muted-foreground">Identifican tu perfil público.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Nombre completo *</Label>
            <Input
              id="full_name"
              name="full_name"
              value={draft.full_name}
              onChange={(event) =>
                setDraft((d) => ({ ...d, full_name: event.target.value }))
              }
              aria-invalid={Boolean(fieldError(state, "full_name"))}
              placeholder="María García"
            />
            {fieldError(state, "full_name") && (
              <p className="text-sm text-destructive">{fieldError(state, "full_name")}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="username">Username *</Label>
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
            <p className="text-xs text-muted-foreground">
              3-30 caracteres: minúsculas, números, guiones y guiones bajos.
            </p>
            {fieldError(state, "username") && (
              <p className="text-sm text-destructive">{fieldError(state, "username")}</p>
            )}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="headline">Titular</Label>
            <Input
              id="headline"
              name="headline"
              value={draft.headline}
              onChange={(event) => setDraft((d) => ({ ...d, headline: event.target.value }))}
              aria-invalid={Boolean(fieldError(state, "headline"))}
              placeholder="Fundadora de Acme, apasionada de la sostenibilidad"
            />
            {fieldError(state, "headline") && (
              <p className="text-sm text-destructive">{fieldError(state, "headline")}</p>
            )}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              name="location"
              value={draft.location}
              onChange={(event) => setDraft((d) => ({ ...d, location: event.target.value }))}
              aria-invalid={Boolean(fieldError(state, "location"))}
              placeholder="Madrid, España"
            />
            {fieldError(state, "location") && (
              <p className="text-sm text-destructive">{fieldError(state, "location")}</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">Biografía</h2>
          <p className="text-sm text-muted-foreground">Tu historia y qué te mueve.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="bio">Biografía</Label>
          <Textarea
            id="bio"
            name="bio"
            value={draft.bio}
            onChange={(event) => setDraft((d) => ({ ...d, bio: event.target.value }))}
            placeholder="Cuéntanos tu experiencia, tu proyecto actual y qué te gustaría conseguir…"
          />
          <p className="text-xs text-muted-foreground">{draft.bio.length}/1000 caracteres</p>
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">Perfil profesional</h2>
          <p className="text-sm text-muted-foreground">Cómo colaborar con otros miembros.</p>
        </div>

        <div>
          <span className="text-sm leading-none font-medium">Tipo de usuario *</span>
          <p className="mt-1 text-sm text-muted-foreground">Puedes elegir más de una.</p>
          <div className="mt-3">
            <ChipGroup
              name="user_types"
              options={USER_TYPES.map((value) => ({ value, label: USER_TYPE_LABELS[value] }))}
              value={draft.user_types}
              onChange={(next) => setDraft((d) => ({ ...d, user_types: next }))}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="weekly_availability">Disponibilidad semanal (horas) *</Label>
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
              placeholder="10"
            />
            <span className="text-sm text-muted-foreground">
              horas de 0 a {MAX_AVAILABILITY}
            </span>
          </div>
          {fieldError(state, "weekly_availability") && (
            <p className="text-sm text-destructive">
              {fieldError(state, "weekly_availability")}
            </p>
          )}
        </div>

        <div>
          <span className="text-sm leading-none font-medium">Preferencias de colaboración</span>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona todas las que apliquen.
          </p>
          <div className="mt-3">
            <ChipGroup
              name="collaboration_preferences"
              options={COLLABORATION_PREFERENCES.map((value) => ({
                value,
                label: COLLABORATION_PREFERENCE_LABELS[value],
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
          <h2 className="text-lg font-semibold">Habilidades e intereses</h2>
          <p className="text-sm text-muted-foreground">
            Ayuda a otros a encontrar qué ofreces y qué te interesa.
          </p>
        </div>

        <div>
          <span className="text-sm leading-none font-medium">Habilidades</span>
          <p className="mt-1 text-sm text-muted-foreground">
            Marca las que tengas y, si quieres, su nivel.
          </p>
          <div className="mt-3">
            <SkillSelector
              skills={skills}
              value={draft.habilidades}
              onChange={(next) => setDraft((d) => ({ ...d, habilidades: next }))}
            />
          </div>
        </div>

        <div>
          <span className="text-sm leading-none font-medium">Intereses</span>
          <p className="mt-1 text-sm text-muted-foreground">
            Temas que te gustaría explorar o sobre los que aprender.
          </p>
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
          <h2 className="text-lg font-semibold">Enlaces y privacidad</h2>
          <p className="text-sm text-muted-foreground">Conecta tu perfil con el resto del mundo.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="website_url">Web</Label>
            <Input
              id="website_url"
              name="website_url"
              value={draft.website_url}
              onChange={(event) =>
                setDraft((d) => ({ ...d, website_url: event.target.value }))
              }
              aria-invalid={Boolean(fieldError(state, "website_url"))}
              placeholder="https://miproyecto.com"
            />
            {fieldError(state, "website_url") && (
              <p className="text-sm text-destructive">{fieldError(state, "website_url")}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="linkedin_url">LinkedIn</Label>
            <Input
              id="linkedin_url"
              name="linkedin_url"
              value={draft.linkedin_url}
              onChange={(event) =>
                setDraft((d) => ({ ...d, linkedin_url: event.target.value }))
              }
              aria-invalid={Boolean(fieldError(state, "linkedin_url"))}
              placeholder="https://linkedin.com/in/maria"
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
            <span className="block text-sm font-medium">Perfil público</span>
            <span className="block text-xs text-muted-foreground">
              Cualquier persona podrá ver tu perfil sin necesidad de iniciar sesión.
            </span>
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
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
