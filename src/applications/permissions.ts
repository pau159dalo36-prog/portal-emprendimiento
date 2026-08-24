import type { ApplicationStatus } from "@/applications/config";
import { APPLICATION_PENDING_STATUSES } from "@/applications/config";

// Espejo en TS de la máquina de estados de applications_validate_transition()
// (migración fase 8). Única fuente de verdad para la UI; la BD vuelve a
// validar siempre (defensa en profundidad, nunca se confía solo en el cliente).

const VALID_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  submitted: ["viewed", "accepted", "rejected", "withdrawn"],
  viewed: ["accepted", "rejected", "withdrawn"],
  accepted: [],
  rejected: [],
  withdrawn: [],
};

export function isValidTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function isPendingStatus(status: ApplicationStatus): boolean {
  return (APPLICATION_PENDING_STATUSES as readonly string[]).includes(status);
}

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/** El applicant solo puede retirar su candidatura pendiente. */
export function canWithdraw(actorId: string, applicantId: string, status: ApplicationStatus): boolean {
  return actorId === applicantId && isPendingStatus(status);
}

/** El manager solo puede marcar vista / aceptar / rechazar candidaturas pendientes. */
export function canDecide(
  actorIsManager: boolean,
  status: ApplicationStatus,
): status is "submitted" | "viewed" {
  return actorIsManager && isPendingStatus(status);
}

/** Estados a los que puede avanzar cada actor desde el estado actual. */
export function nextStatusesForActor(
  actor: "applicant" | "manager",
  status: ApplicationStatus,
): readonly ApplicationStatus[] {
  if (!isPendingStatus(status)) {
    return [];
  }
  if (actor === "applicant") {
    return ["withdrawn"];
  }
  // El manager nunca retira (withdrawn es exclusivo del applicant).
  return VALID_TRANSITIONS[status].filter((next) => next !== "withdrawn");
}
