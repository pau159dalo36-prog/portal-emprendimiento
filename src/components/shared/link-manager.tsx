"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Plus } from "lucide-react";

import { initialFormState, type FormState } from "@/actions/form-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

export type LinkManagerItem = {
  id: string;
  link_type: string;
  label: string;
  url: string;
};

type LinkManagerProps = {
  links: LinkManagerItem[];
  linkTypes: readonly string[];
  addAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  removeAction: (formData: FormData) => Promise<void>;
  entityFieldName: string;
  entityId: string;
  canManage: boolean;
};

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

export function LinkManager({
  links,
  linkTypes,
  addAction,
  removeAction,
  entityFieldName,
  entityId,
  canManage,
}: LinkManagerProps) {
  const t = useTranslations("managers");
  const types = useTranslations("linkTypes");
  const [state, formAction, pending] = useActionState(addAction, initialFormState);

  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">{t("linksTitle")}</h2>

      {links.length > 0 ? (
        <ul className="grid gap-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge className="border-primary/30 bg-primary/10 text-primary">
                  {types(link.link_type as Parameters<typeof types>[0])}
                </Badge>
                <Link
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm font-medium hover:underline"
                >
                  {link.label}
                </Link>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
              {canManage && (
                <form action={removeAction}>
                  <input type="hidden" name="link_id" value={link.id} />
                  <Button type="submit" size="sm" variant="destructive">
                    {t("remove")}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noLinks")}</p>
      )}

      {canManage && (
        <form
          action={formAction}
          noValidate
          className="grid gap-2 rounded-lg border border-dashed border-border p-4"
        >
          <input type="hidden" name={entityFieldName} value={entityId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${entityFieldName}-link-type`}>{t("linkType")}</Label>
              <select
                id={`${entityFieldName}-link-type`}
                name="link_type"
                defaultValue={linkTypes[0]}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                {linkTypes.map((type) => (
                  <option key={type} value={type}>
                    {types(type as Parameters<typeof types>[0])}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${entityFieldName}-link-label`}>{t("linkLabel")}</Label>
              <Input
                id={`${entityFieldName}-link-label`}
                name="label"
                placeholder={t("linkLabelPlaceholder")}
                aria-invalid={Boolean(fieldError(state, "label"))}
              />
              {fieldError(state, "label") && (
                <p className="text-sm text-destructive">{fieldError(state, "label")}</p>
              )}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`${entityFieldName}-link-url`}>{t("linkUrl")}</Label>
              <Input
                id={`${entityFieldName}-link-url`}
                name="url"
                type="url"
                placeholder={t("linkUrlPlaceholder")}
                aria-invalid={Boolean(fieldError(state, "url"))}
              />
              {fieldError(state, "url") && (
                <p className="text-sm text-destructive">{fieldError(state, "url")}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FormMessage status={state.status === "idle" ? undefined : state.status}>
              {state.status === "idle" ? undefined : state.message}
            </FormMessage>
            <Button type="submit" disabled={pending} className="ml-auto">
              <Plus aria-hidden="true" />
              {t("addLinkSubmit")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
