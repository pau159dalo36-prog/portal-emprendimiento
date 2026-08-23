"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, Send } from "lucide-react";

import { saveOpportunityAction } from "@/actions/opportunity";
import { initialFormState, type FormState } from "@/actions/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INDUSTRIES } from "@/organizations/constants";
import {
  COMPENSATION_PERIODS,
  COMPENSATION_TYPES,
  COUNTRIES,
  CURRENCIES,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  ONE_DAY_COMPENSATION_PERIODS,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_VISIBILITIES,
  WORK_MODES,
} from "@/opportunities/constants";
import { emptyOpportunityFormData, type OpportunityFormData } from "@/opportunities/map";

export type OpportunityScopeOption = {
  id: string;
  name: string;
};

type OpportunityFormProps = {
  mode: "create" | "edit";
  initial?: OpportunityFormData;
  opportunityId?: string;
  projects?: OpportunityScopeOption[];
  organizations?: OpportunityScopeOption[];
};

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const VISIBILITY_LABELS: Record<string, string> = {
  public: "public",
  registered_users: "registeredUsers",
  project_members: "projectMembers",
  private: "private",
  unlisted: "unlisted",
};

export function OpportunityForm({
  mode,
  initial,
  opportunityId,
  projects = [],
  organizations = [],
}: OpportunityFormProps) {
  const t = useTranslations("opportunityForm");
  const types = useTranslations("opportunityTypes");
  const employmentTypes = useTranslations("employmentTypes");
  const workModes = useTranslations("workModes");
  const experienceLevels = useTranslations("experienceLevels");
  const compensationTypes = useTranslations("compensationTypes");
  const compensationPeriods = useTranslations("compensationPeriods");
  const industries = useTranslations("industries");

  const [state, formAction, pending] = useActionState(saveOpportunityAction, initialFormState);
  const [draft, setDraft] = useState<OpportunityFormData>(
    () => initial ?? emptyOpportunityFormData,
  );

  const isEmploymentScope =
    draft.opportunity_type === "job" || draft.opportunity_type === "internship";
  const isOneDay = draft.opportunity_type === "one_day_shift";
  const isMonetary = draft.compensation_type === "monetary";
  const periods = isOneDay ? ONE_DAY_COMPENSATION_PERIODS : COMPENSATION_PERIODS;

  function set<K extends keyof OpportunityFormData>(key: K, value: OpportunityFormData[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {mode === "edit" && opportunityId && (
        <input type="hidden" name="opportunity_id" value={opportunityId} />
      )}
      <input type="hidden" name="status" value={draft.status} />
      {isOneDay && (
        <input type="hidden" name="visibility" value={draft.visibility} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="title">{t("titleLabel")}</Label>
          <Input
            id="title"
            name="title"
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
            aria-invalid={Boolean(fieldError(state, "title"))}
            placeholder={t("titlePlaceholder")}
          />
          {fieldError(state, "title") && (
            <p className="text-sm text-destructive">{fieldError(state, "title")}</p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="description">{t("descriptionLabel")}</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
            aria-invalid={Boolean(fieldError(state, "description"))}
            placeholder={t("descriptionPlaceholder")}
          />
          {fieldError(state, "description") && (
            <p className="text-sm text-destructive">{fieldError(state, "description")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="opportunity_type">{t("typeLabel")}</Label>
          <select
            id="opportunity_type"
            name="opportunity_type"
            value={draft.opportunity_type}
            onChange={(event) => {
              const value = event.target.value;
              const next: OpportunityFormData = {
                ...draft,
                opportunity_type: value,
              };
              if (value !== "job" && value !== "internship") {
                next.employment_type = "";
                next.work_mode = "";
              }
              if (value !== "one_day_shift") {
                next.starts_at = "";
                next.ends_at = "";
                next.slots_total = "";
              }
              if (value === "one_day_shift") {
                next.compensation_period = "";
                next.compensation_min = "";
                next.compensation_max = "";
                next.currency = "";
              }
              setDraft(next);
            }}
            className={selectClassName}
          >
            {OPPORTUNITY_TYPES.map((value) => (
              <option key={value} value={value}>
                {types(value)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("typeHint")}</p>
          {fieldError(state, "opportunity_type") && (
            <p className="text-sm text-destructive">{fieldError(state, "opportunity_type")}</p>
          )}
        </div>

        {isEmploymentScope && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="employment_type">{t("employmentTypeLabel")}</Label>
              <select
                id="employment_type"
                name="employment_type"
                value={draft.employment_type}
                onChange={(event) => set("employment_type", event.target.value)}
                className={selectClassName}
              >
                <option value="">{t("employmentTypeNone")}</option>
                {EMPLOYMENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {employmentTypes(value)}
                  </option>
                ))}
              </select>
              {fieldError(state, "employment_type") && (
                <p className="text-sm text-destructive">
                  {fieldError(state, "employment_type")}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="work_mode">{t("workModeLabel")}</Label>
              <select
                id="work_mode"
                name="work_mode"
                value={draft.work_mode}
                onChange={(event) => set("work_mode", event.target.value)}
                className={selectClassName}
              >
                <option value="">{t("workModeNone")}</option>
                {WORK_MODES.map((value) => (
                  <option key={value} value={value}>
                    {workModes(value)}
                  </option>
                ))}
              </select>
              {fieldError(state, "work_mode") && (
                <p className="text-sm text-destructive">{fieldError(state, "work_mode")}</p>
              )}
            </div>
          </>
        )}

        <div className="grid gap-2">
          <Label htmlFor="experience_level">{t("experienceLabel")}</Label>
          <select
            id="experience_level"
            name="experience_level"
            value={draft.experience_level}
            onChange={(event) => set("experience_level", event.target.value)}
            className={selectClassName}
          >
            <option value="">{t("experienceNone")}</option>
            {EXPERIENCE_LEVELS.map((value) => (
              <option key={value} value={value}>
                {experienceLevels(value)}
              </option>
            ))}
          </select>
          {fieldError(state, "experience_level") && (
            <p className="text-sm text-destructive">{fieldError(state, "experience_level")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="industry">{t("industryLabel")}</Label>
          <select
            id="industry"
            name="industry"
            value={draft.industry}
            onChange={(event) => set("industry", event.target.value)}
            className={selectClassName}
          >
            <option value="">{t("industryNone")}</option>
            {INDUSTRIES.map((value) => (
              <option key={value} value={value}>
                {industries(value)}
              </option>
            ))}
          </select>
          {fieldError(state, "industry") && (
            <p className="text-sm text-destructive">{fieldError(state, "industry")}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="compensation_type">{t("compensationLabel")}</Label>
          <select
            id="compensation_type"
            name="compensation_type"
            value={draft.compensation_type}
            onChange={(event) => {
              const value = event.target.value;
              setDraft((d) => {
                const next = { ...d, compensation_type: value };
                if (value !== "monetary") {
                  next.compensation_min = "";
                  next.compensation_max = "";
                  next.currency = "";
                  next.compensation_period = "";
                }
                return next;
              });
            }}
            className={selectClassName}
          >
            <option value="">{t("compensationNone")}</option>
            {COMPENSATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {compensationTypes(value)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("compensationHint")}</p>
          {fieldError(state, "compensation_type") && (
            <p className="text-sm text-destructive">{fieldError(state, "compensation_type")}</p>
          )}
        </div>

        {isMonetary && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="compensation_min">{t("compensationMinLabel")}</Label>
              <Input
                id="compensation_min"
                name="compensation_min"
                type="number"
                min={0}
                value={draft.compensation_min}
                onChange={(event) => set("compensation_min", event.target.value)}
                aria-invalid={Boolean(fieldError(state, "compensation_min"))}
              />
              {fieldError(state, "compensation_min") && (
                <p className="text-sm text-destructive">
                  {fieldError(state, "compensation_min")}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="compensation_max">{t("compensationMaxLabel")}</Label>
              <Input
                id="compensation_max"
                name="compensation_max"
                type="number"
                min={0}
                value={draft.compensation_max}
                onChange={(event) => set("compensation_max", event.target.value)}
                aria-invalid={Boolean(fieldError(state, "compensation_max"))}
              />
              {fieldError(state, "compensation_max") && (
                <p className="text-sm text-destructive">
                  {fieldError(state, "compensation_max")}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currency">{t("currencyLabel")}</Label>
              <select
                id="currency"
                name="currency"
                value={draft.currency}
                onChange={(event) => set("currency", event.target.value)}
                className={selectClassName}
              >
                <option value="">{t("currencyNone")}</option>
                {CURRENCIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              {fieldError(state, "currency") && (
                <p className="text-sm text-destructive">{fieldError(state, "currency")}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="compensation_period">{t("periodLabel")}</Label>
              <select
                id="compensation_period"
                name="compensation_period"
                value={draft.compensation_period}
                onChange={(event) => set("compensation_period", event.target.value)}
                className={selectClassName}
              >
                <option value="">{t("periodNone")}</option>
                {periods.map((value) => (
                  <option key={value} value={value}>
                    {compensationPeriods(value)}
                  </option>
                ))}
              </select>
              {fieldError(state, "compensation_period") && (
                <p className="text-sm text-destructive">
                  {fieldError(state, "compensation_period")}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="country">{t("countryLabel")}</Label>
          <select
            id="country"
            name="country"
            value={draft.country}
            onChange={(event) => set("country", event.target.value)}
            className={selectClassName}
          >
            <option value="">{t("countryNone")}</option>
            {COUNTRIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {fieldError(state, "country") && (
            <p className="text-sm text-destructive">{fieldError(state, "country")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="region">{t("regionLabel")}</Label>
          <Input
            id="region"
            name="region"
            value={draft.region}
            onChange={(event) => set("region", event.target.value)}
            aria-invalid={Boolean(fieldError(state, "region"))}
          />
          {fieldError(state, "region") && (
            <p className="text-sm text-destructive">{fieldError(state, "region")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="city">{t("cityLabel")}</Label>
          <Input
            id="city"
            name="city"
            value={draft.city}
            onChange={(event) => set("city", event.target.value)}
            aria-invalid={Boolean(fieldError(state, "city"))}
          />
          {fieldError(state, "city") && (
            <p className="text-sm text-destructive">{fieldError(state, "city")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="location_text">{t("locationTextLabel")}</Label>
          <Input
            id="location_text"
            name="location_text"
            value={draft.location_text}
            onChange={(event) => set("location_text", event.target.value)}
            aria-invalid={Boolean(fieldError(state, "location_text"))}
            placeholder={t("locationTextPlaceholder")}
          />
          {fieldError(state, "location_text") && (
            <p className="text-sm text-destructive">{fieldError(state, "location_text")}</p>
          )}
        </div>
      </div>

      {isOneDay && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="starts_at">{t("startsAtLabel")}</Label>
            <Input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              value={draft.starts_at}
              onChange={(event) => set("starts_at", event.target.value)}
              aria-invalid={Boolean(fieldError(state, "starts_at"))}
            />
            {fieldError(state, "starts_at") && (
              <p className="text-sm text-destructive">{fieldError(state, "starts_at")}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ends_at">{t("endsAtLabel")}</Label>
            <Input
              id="ends_at"
              name="ends_at"
              type="datetime-local"
              value={draft.ends_at}
              onChange={(event) => set("ends_at", event.target.value)}
              aria-invalid={Boolean(fieldError(state, "ends_at"))}
            />
            {fieldError(state, "ends_at") && (
              <p className="text-sm text-destructive">{fieldError(state, "ends_at")}</p>
            )}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="slots_total">{t("slotsLabel")}</Label>
            <Input
              id="slots_total"
              name="slots_total"
              type="number"
              min={1}
              value={draft.slots_total}
              onChange={(event) => set("slots_total", event.target.value)}
              aria-invalid={Boolean(fieldError(state, "slots_total"))}
              placeholder={t("slotsPlaceholder")}
            />
            {fieldError(state, "slots_total") && (
              <p className="text-sm text-destructive">{fieldError(state, "slots_total")}</p>
            )}
          </div>
        </div>
      )}

      {!isOneDay && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="closes_at">{t("closesAtLabel")}</Label>
            <Input
              id="closes_at"
              name="closes_at"
              type="datetime-local"
              value={draft.closes_at}
              onChange={(event) => set("closes_at", event.target.value)}
              aria-invalid={Boolean(fieldError(state, "closes_at"))}
            />
            <p className="text-xs text-muted-foreground">{t("closesAtHint")}</p>
            {fieldError(state, "closes_at") && (
              <p className="text-sm text-destructive">{fieldError(state, "closes_at")}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="visibility">{t("visibilityLabel")}</Label>
            <select
              id="visibility"
              name="visibility"
              value={draft.visibility}
              onChange={(event) => set("visibility", event.target.value)}
              className={selectClassName}
            >
              {OPPORTUNITY_VISIBILITIES.map((value) => (
                <option key={value} value={value}>
                  {t(`visibility.${VISIBILITY_LABELS[value]}`)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("visibilityHint")}</p>
            {fieldError(state, "visibility") && (
              <p className="text-sm text-destructive">{fieldError(state, "visibility")}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="project_id">{t("projectLabel")}</Label>
          <select
            id="project_id"
            name="project_id"
            value={draft.project_id}
            onChange={(event) => set("project_id", event.target.value)}
            className={selectClassName}
          >
            <option value="">{t("projectNone")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("projectHint")}</p>
          {fieldError(state, "project_id") && (
            <p className="text-sm text-destructive">{fieldError(state, "project_id")}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="organization_id">{t("organizationLabel")}</Label>
          <select
            id="organization_id"
            name="organization_id"
            value={draft.organization_id}
            onChange={(event) => set("organization_id", event.target.value)}
            className={selectClassName}
          >
            <option value="">{t("organizationNone")}</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("organizationHint")}</p>
          {fieldError(state, "organization_id") && (
            <p className="text-sm text-destructive">{fieldError(state, "organization_id")}</p>
          )}
        </div>
      </div>

      {!isOneDay && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-border p-4">
            <input
              type="checkbox"
              name="is_first_job_friendly"
              checked={draft.is_first_job_friendly}
              onChange={(event) => set("is_first_job_friendly", event.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">{t("firstJobLabel")}</span>
              <span className="block text-xs text-muted-foreground">{t("firstJobHint")}</span>
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-border p-4">
            <input
              type="checkbox"
              name="is_student_friendly"
              checked={draft.is_student_friendly}
              onChange={(event) => set("is_student_friendly", event.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">{t("studentFriendlyLabel")}</span>
              <span className="block text-xs text-muted-foreground">{t("studentFriendlyHint")}</span>
            </span>
          </label>
        </div>
      )}

      <div className="grid gap-3 border-t border-border pt-6 sm:grid-cols-[1fr_auto_auto]">
        <FormMessage status={state.status === "idle" ? undefined : state.status}>
          {state.status === "idle" ? undefined : state.message}
        </FormMessage>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <Button type="submit" name="intent" value="save" disabled={pending} variant="outline">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {t("saveButton")}
          </Button>
          <Button type="submit" name="intent" value="publish" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {t("publishButton")}
          </Button>
        </div>
      </div>
    </form>
  );
}
