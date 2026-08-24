"use client";

import { Check } from "lucide-react";

import { markNotificationReadAction } from "@/actions/notifications";
import { buttonVariants } from "@/components/ui/button";

/** Marca una notificación concreta como leída. El recipient lo fija la sesión
 * (auth.uid()); el id viaja en el formulario y la RLS acota el UPDATE. */
export function MarkReadForm({ id, label }: { id: string; label: string }) {
  return (
    <form action={markNotificationReadAction} className="shrink-0 self-center">
      <input type="hidden" name="notification_id" value={id} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
      >
        <Check aria-hidden="true" />
      </button>
    </form>
  );
}
