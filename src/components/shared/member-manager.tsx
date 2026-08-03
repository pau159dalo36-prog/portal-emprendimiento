"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";

import { initialFormState, type FormState } from "@/actions/form-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

export type MemberManagerItem = {
  id: string;
  role: string;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

type MemberManagerProps = {
  members: MemberManagerItem[];
  roles: readonly string[];
  roleLabelsNamespace: "orgRoles" | "projectRoles";
  addAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  updateRoleAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  entityFieldName: string;
  entityId: string;
  canManage: boolean;
};

function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

export function MemberManager({
  members,
  roles,
  roleLabelsNamespace,
  addAction,
  updateRoleAction,
  removeAction,
  entityFieldName,
  entityId,
  canManage,
}: MemberManagerProps) {
  const t = useTranslations("managers");
  const rolesT = useTranslations(roleLabelsNamespace);
  const [state, formAction, pending] = useActionState(addAction, initialFormState);

  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">{t("membersTitle")}</h2>

      {members.length > 0 ? (
        <ul className="grid gap-2">
          {members.map((member) => {
            const isOwnerRow = member.role === "owner";
            const name = member.profile?.full_name ?? "—";
            const profileHref = member.profile?.username
              ? `/perfil/${member.profile.username}`
              : null;

            return (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={member.profile?.full_name} src={member.profile?.avatar_url} size="sm" />
                  <div className="min-w-0">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-medium">{name}</span>
                    )}
                    {member.profile?.username && (
                      <p className="truncate text-xs text-muted-foreground">
                        @{member.profile.username}
                      </p>
                    )}
                  </div>
                </div>

                {isOwnerRow || !canManage ? (
                  <Badge className="border-border bg-muted text-muted-foreground">
                    {rolesT(member.role as Parameters<typeof rolesT>[0])}
                  </Badge>
                ) : (
                  <form action={updateRoleAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="member_id" value={member.id} />
                    <select
                      name="role"
                      defaultValue={member.role}
                      aria-label={t("role")}
                      className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {rolesT(role as Parameters<typeof rolesT>[0])}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">
                      {t("updateRole")}
                    </Button>
                    <Button type="submit" formAction={removeAction} size="sm" variant="destructive">
                      {t("remove")}
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
      )}

      {canManage && (
        <form
          action={formAction}
          noValidate
          className="grid gap-2 rounded-lg border border-dashed border-border p-4"
        >
          <input type="hidden" name={entityFieldName} value={entityId} />
          <div className="grid gap-2">
            <Label htmlFor={`${entityFieldName}-username`}>{t("addMember")}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`${entityFieldName}-username`}
                name="username"
                placeholder={t("memberUsernamePlaceholder")}
                autoComplete="off"
                aria-invalid={Boolean(fieldError(state, "username"))}
                className="max-w-64"
              />
              <Button type="submit" disabled={pending}>
                <UserPlus aria-hidden="true" />
                {t("addMemberSubmit")}
              </Button>
            </div>
            {fieldError(state, "username") && (
              <p className="text-sm text-destructive">{fieldError(state, "username")}</p>
            )}
          </div>
          <FormMessage status={state.status === "idle" ? undefined : state.status}>
            {state.status === "idle" ? undefined : state.message}
          </FormMessage>
        </form>
      )}
    </div>
  );
}
