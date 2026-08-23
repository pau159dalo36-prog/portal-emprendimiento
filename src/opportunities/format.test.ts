// Tests de helpers de formato de oportunidades (funciones puras, sin i18n ni I/O).
import { describe, expect, it } from "vitest";

import {
  formatCompensation,
  getShiftDayLabelKey,
  isShiftPast,
  toCompensationDisplay,
  toLocationParts,
  withTranslatedPeriod,
} from "@/opportunities/format";

describe("toCompensationDisplay", () => {
  it("mapea un tipo válido y conserva min/max/currency/period", () => {
    expect(
      toCompensationDisplay({
        compensation_type: "monetary",
        compensation_min: 1000,
        compensation_max: 1500,
        currency: "EUR",
        compensation_period: "month",
      }),
    ).toEqual({
      kind: "monetary",
      min: 1000,
      max: 1500,
      currency: "EUR",
      period: "month",
    });
  });

  it("un tipo desconocido cae a none", () => {
    expect(
      toCompensationDisplay({
        compensation_type: "carro",
        compensation_min: null,
        compensation_max: null,
        currency: null,
        compensation_period: null,
      }).kind,
    ).toBe("none");
  });
});

describe("formatCompensation", () => {
  const base = {
    compensation_min: null,
    compensation_max: null,
    currency: null,
    compensation_period: null,
  };

  it("monetary con rango y periodo → rango formateado con periodo crudo", () => {
    const result = formatCompensation(
      { compensation_type: "monetary", compensation_min: 1200, compensation_max: 2000, currency: "EUR", compensation_period: "month" },
      "es",
    );
    expect(result.kind).toBe("monetary");
    expect(result.hasRange).toBe(true);
    expect(result.period).toBe("month");
    expect(result.value).toContain("–");
    expect(result.value).toContain("€");
    expect(result.value).toContain("/ month");
  });

  it("monetary sin rango → importe único", () => {
    const result = formatCompensation(
      { compensation_type: "monetary", compensation_min: 500, compensation_max: 500, currency: "USD", compensation_period: null },
      "en",
    );
    expect(result.hasRange).toBe(false);
    expect(result.value).toBe("$500");
  });

  it("monetary sin importes → null", () => {
    const result = formatCompensation({ compensation_type: "monetary", ...base }, "es");
    expect(result.value).toBeNull();
  });

  it("equity → valor es la clave del tipo (para traducir en UI)", () => {
    const result = formatCompensation({ compensation_type: "equity", ...base }, "es");
    expect(result.kind).toBe("equity");
    expect(result.value).toBe("equity");
  });

  it("none → null (nada que mostrar)", () => {
    const result = formatCompensation({ compensation_type: "invalido", ...base }, "es");
    expect(result.kind).toBe("none");
    expect(result.value).toBeNull();
  });
});

describe("withTranslatedPeriod", () => {
  it("traduce el sufijo del periodo", () => {
    const display = formatCompensation(
      { compensation_type: "monetary", compensation_min: 1000, compensation_max: null, currency: "EUR", compensation_period: "month" },
      "es",
    );
    const translated = withTranslatedPeriod(display, (period) => `por ${period}`);
    expect(translated).toContain("1000");
    expect(translated).toContain("€");
    expect(translated).toContain("/ por month");
  });

  it("devuelve el valor tal cual sin periodo o sin importe", () => {
    expect(withTranslatedPeriod({ value: "1.000 €", period: null }, (p) => p)).toBe("1.000 €");
    expect(withTranslatedPeriod({ value: null, period: "month" }, (p) => p)).toBeNull();
  });
});

describe("toLocationParts", () => {
  it("combina ciudad, región y país (sin deduplicar)", () => {
    expect(
      toLocationParts({ city: "Madrid", region: "Comunidad de Madrid", country: "ES", location_text: null }),
    ).toEqual(["Madrid", "Comunidad de Madrid", "ES"]);
  });

  it("usa location_text cuando no hay partes estructuradas", () => {
    expect(
      toLocationParts({ city: "", region: null, country: "", location_text: "Avenida de América" }),
    ).toEqual(["Avenida de América"]);
  });
});

describe("getShiftDayLabelKey", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");

  it("hoy para un turno que empieza hoy", () => {
    expect(getShiftDayLabelKey("2026-08-14T18:00:00.000Z", now)).toBe("today");
  });

  it("mañana para un turno al día siguiente", () => {
    expect(getShiftDayLabelKey("2026-08-15T09:00:00.000Z", now)).toBe("tomorrow");
  });

  it("date para un turno más lejano", () => {
    expect(getShiftDayLabelKey("2026-08-30T09:00:00.000Z", now)).toBe("date");
  });

  it("null sin fecha o con fecha inválida", () => {
    expect(getShiftDayLabelKey(null, now)).toBeNull();
    expect(getShiftDayLabelKey("no-es-una-fecha", now)).toBeNull();
  });
});

describe("isShiftPast", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");

  it("true cuando el turno ya terminó", () => {
    expect(isShiftPast("2026-08-14T11:00:00.000Z", now)).toBe(true);
  });

  it("false mientras no ha terminado", () => {
    expect(isShiftPast("2026-08-14T13:00:00.000Z", now)).toBe(false);
  });

  it("false sin fecha de fin", () => {
    expect(isShiftPast(null, now)).toBe(false);
  });
});
