// Helpers puros de formato de oportunidades (sin i18n ni I/O: testables).

export type CompensationInput = {
  compensation_type: string | null;
  compensation_min: number | null;
  compensation_max: number | null;
  currency: string | null;
  compensation_period: string | null;
};

export type CompensationDisplay = {
  kind: "monetary" | "equity" | "negotiable" | "unpaid" | "none";
  min: number | null;
  max: number | null;
  currency: string | null;
  period: string | null;
};

export function toCompensationDisplay(
  input: CompensationInput,
): CompensationDisplay {
  const kind = (["monetary", "equity", "negotiable", "unpaid"] as const).includes(
    input.compensation_type as never,
  )
    ? (input.compensation_type as CompensationDisplay["kind"])
    : "none";
  return {
    kind,
    min: input.compensation_min,
    max: input.compensation_max,
    currency: input.currency,
    period: input.compensation_period,
  };
}

export function formatCurrencyAmount(
  amount: number,
  currency: string,
  locale: string,
): string {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export type CompensationDisplayValue = {
  value: string | null;
  hasRange: boolean;
  kind: CompensationDisplay["kind"];
  period: string | null;
};

// "1.200 – 2.000 EUR / mes" (monetary con periodo) o "1.200 EUR" (sin periodo).
// Devuelve null cuando no hay nada que mostrar. `kind` permite a la UI decidir
// si renderiza el importe o una etiqueta traducida del tipo de compensación y
// `period` (crudo) para traducir el sufijo con withTranslatedPeriod.
export function formatCompensation(
  input: CompensationInput,
  locale: string,
): CompensationDisplayValue {
  const display = toCompensationDisplay(input);
  if (display.kind === "monetary") {
    if (display.min === null && display.max === null) {
      return { value: null, hasRange: false, kind: display.kind, period: null };
    }
    if (display.min !== null && display.max !== null && display.min !== display.max) {
      const range = `${formatCurrencyAmount(display.min, display.currency ?? "", locale)} – ${formatCurrencyAmount(
        display.max,
        display.currency ?? "",
        locale,
      )}`;
      return { value: display.period ? `${range} / ${display.period}` : range, hasRange: true, kind: display.kind, period: display.period };
    }
    const amount = display.min ?? display.max ?? 0;
    const value = formatCurrencyAmount(amount, display.currency ?? "", locale);
    return { value: display.period ? `${value} / ${display.period}` : value, hasRange: false, kind: display.kind, period: display.period };
  }
  if (display.kind === "none") {
    return { value: null, hasRange: false, kind: display.kind, period: null };
  }
  return { value: display.kind, hasRange: false, kind: display.kind, period: null };
}

// Sustituye el periodo crudo del sufijo ("/ month") por su traducción. Los
// componentes no-monetary y las cantidades sin periodo se devuelven tal cual.
export function withTranslatedPeriod(
  display: Pick<CompensationDisplayValue, "value" | "period">,
  translatePeriod: (period: string) => string,
): string | null {
  if (!display.value || !display.period) {
    return display.value;
  }
  return display.value.replace(` / ${display.period}`, ` / ${translatePeriod(display.period)}`);
}

export type OpportunityLocation = {
  country: string | null;
  region: string | null;
  city: string | null;
  location_text: string | null;
};

// Ubicación legible: ciudad, región, país — sin duplicados ni separadores
// colgantes. La etiqueta del país la resuelve la UI (país ISO → nombre).
export function toLocationParts(input: OpportunityLocation): string[] {
  const parts = [input.city, input.region, input.country].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  if (parts.length === 0 && input.location_text) {
    return [input.location_text.trim()];
  }
  return parts;
}

// Día de un turno: "hoy", "mañana", "sábado 30", etc. null si no es turno.
export function getShiftDayLabelKey(
  startsAt: string | null,
  now: Date,
): "today" | "tomorrow" | "date" | null {
  if (!startsAt) {
    return null;
  }
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((startDay.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) {
    return "today";
  }
  if (diffDays === 1) {
    return "tomorrow";
  }
  return "date";
}

export function isShiftPast(endsAt: string | null, now: Date): boolean {
  if (!endsAt) {
    return false;
  }
  const end = new Date(endsAt);
  return !Number.isNaN(end.getTime()) && end.getTime() <= now.getTime();
}
