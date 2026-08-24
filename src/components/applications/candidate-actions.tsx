"use client";

import { useTranslations } from "next-intl";
import { Check, Eye, X } from "lucide-react";

import {
  acceptApplicationAction,
  markApplicationViewedAction,
  rejectApplicationAction,
} from "@/actions/application";
import type { ApplicationStatus } from "@/applications/config";
import { isPendingStatus } from "@/applications/permissions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CandidateActionsProps = {
  applicationId: string;
  status: ApplicationStatus;
};

/** Acciones del manager sobre una candidatura pendiente: marcar vista,
 * aceptar, rechazar. RLS + trigger rechazan cualquier uso indebido; aquí
 * solo se ocultan las acciones cuando ya no aplican. */
export function CandidateActions({ applicationId, status }: CandidateActionsProps) {
  const t = useTranslations("candidates");

  if (!isPendingStatus(status)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "submitted" && (
        <form action={markApplicationViewedAction}>
          <input type="hidden" name="application_id" value={applicationId} />
          <button
            type="submit"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Eye aria-hidden="true" />
            {t("markViewed")}
          </button>
        </form>
      )}
      <form action={acceptApplicationAction}>
        <input type="hidden" name="application_id" value={applicationId} />
        <button type="submit" className={buttonVariants({ variant: "default", size: "sm" })}>
          <Check aria-hidden="true" />
          {t("accept")}
        </button>
      </form>
      <form action={rejectApplicationAction}>
        <input type="hidden" name="application_id" value={applicationId} />
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-destructive")}
        >
          <X aria-hidden="true" />
          {t("reject")}
        </button>
      </form>
    </div>
  );
}
