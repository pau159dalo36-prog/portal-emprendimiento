"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Archive, PauseCircle, Send } from "lucide-react";

import { changeServiceStatusAction } from "@/actions/service";
import { Button } from "@/components/ui/button";
import {
  SERVICE_STATUS_TRANSITIONS,
  type ServiceStatus,
} from "@/services/constants";

type ServiceStatusControlsProps = {
  serviceId: string;
  status: ServiceStatus;
};

// Controles de ciclo de vida de un servicio propio (panel y detalle). Las
// transiciones válidas se calculan con la misma tabla que aplica el trigger de
// la BD; una acción inválida simplemente no hace nada en el servidor.
export function ServiceStatusControls({ serviceId, status }: ServiceStatusControlsProps) {
  const t = useTranslations("serviceForm");
  const [pending, startTransition] = useTransition();

  const allowed = SERVICE_STATUS_TRANSITIONS[status] ?? [];

  const submit = (next: ServiceStatus) => {
    const formData = new FormData();
    formData.set("service_id", serviceId);
    formData.set("status", next);
    startTransition(async () => {
      await changeServiceStatusAction(formData);
    });
  };

  if (allowed.length === 0 || pending) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowed.includes("published") && (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => submit("published")}
        >
          <Send aria-hidden="true" />
          {status === "paused" ? t("resumeButton") : t("publishButton")}
        </Button>
      )}
      {allowed.includes("paused") && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => submit("paused")}
        >
          <PauseCircle aria-hidden="true" />
          {t("pauseButton")}
        </Button>
      )}
      {status !== "archived" && allowed.includes("archived") && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => submit("archived")}
        >
          <Archive aria-hidden="true" />
          {t("archiveButton")}
        </Button>
      )}
    </div>
  );
}
