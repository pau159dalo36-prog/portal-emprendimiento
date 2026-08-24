export const APPLICATION_STATUSES = [
  "submitted",
  "viewed",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Estados con candidatura viva: el applicant aún puede retirar y editar su
// mensaje; el manager aún puede decidir. El resto son terminales.
export const APPLICATION_PENDING_STATUSES = ["submitted", "viewed"] as const;

// Filtros del panel "Mis candidaturas" (mismos estados, más "todas").
export const APPLICATION_FILTERS = [
  "all",
  ...APPLICATION_STATUSES,
] as const;

export type ApplicationFilter = (typeof APPLICATION_FILTERS)[number];

export const APPLICATION_MESSAGE_MAX_LENGTH = 2000;

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}
