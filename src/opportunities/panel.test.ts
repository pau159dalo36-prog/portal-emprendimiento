// Tests de los helpers de estado del panel de oportunidades (sin I/O).
import { describe, expect, it } from "vitest";

import {
  canCancelOpportunity,
  canCloseOpportunity,
  canEditOpportunity,
  canFillOpportunity,
  canPublishOpportunity,
  getPanelSection,
  PANEL_SECTION_ORDER,
} from "@/opportunities/panel";
import type { PanelOpportunityState } from "@/opportunities/panel";

function state(status: string, moderation_status = "unreviewed"): PanelOpportunityState {
  return { status, moderation_status };
}

describe("getPanelSection", () => {
  it("asigna el borrador a drafts", () => {
    expect(getPanelSection(state("draft"))).toBe("drafts");
  });

  it("publicado sin revisar va a unreviewed", () => {
    expect(getPanelSection(state("published", "unreviewed"))).toBe("unreviewed");
  });

  it("publicado marcado va a flagged", () => {
    expect(getPanelSection(state("published", "flagged"))).toBe("flagged");
  });

  it("publicado rechazado va a rejected", () => {
    expect(getPanelSection(state("published", "rejected"))).toBe("rejected");
  });

  it("publicado aprobado va a published", () => {
    expect(getPanelSection(state("published", "approved"))).toBe("published");
  });

  it("closed, filled y cancelled van a sus secciones", () => {
    expect(getPanelSection(state("closed"))).toBe("closed");
    expect(getPanelSection(state("filled"))).toBe("filled");
    expect(getPanelSection(state("cancelled"))).toBe("cancelled");
  });
});

describe("acciones del panel", () => {
  it("solo se publica desde draft", () => {
    expect(canPublishOpportunity(state("draft"))).toBe(true);
    expect(canPublishOpportunity(state("published"))).toBe(false);
    expect(canPublishOpportunity(state("closed"))).toBe(false);
  });

  it("se edita en draft y publicado (no en estados finales)", () => {
    expect(canEditOpportunity(state("draft"))).toBe(true);
    expect(canEditOpportunity(state("published"))).toBe(true);
    expect(canEditOpportunity(state("closed"))).toBe(false);
  });

  it("cerrar y cubrir solo desde publicado", () => {
    expect(canCloseOpportunity(state("published"))).toBe(true);
    expect(canCloseOpportunity(state("draft"))).toBe(false);
    expect(canFillOpportunity(state("published"))).toBe(true);
    expect(canFillOpportunity(state("filled"))).toBe(false);
  });

  it("cancelar desde cualquier estado salvo cancelled", () => {
    expect(canCancelOpportunity(state("draft"))).toBe(true);
    expect(canCancelOpportunity(state("published"))).toBe(true);
    expect(canCancelOpportunity(state("cancelled"))).toBe(false);
  });
});

describe("PANEL_SECTION_ORDER", () => {
  it("empieza por la cola de moderación y cubre todos los estados", () => {
    expect(PANEL_SECTION_ORDER[0]).toBe("unreviewed");
    expect(PANEL_SECTION_ORDER[1]).toBe("flagged");
    expect(PANEL_SECTION_ORDER[2]).toBe("rejected");
    expect(PANEL_SECTION_ORDER).toContain("drafts");
    expect(PANEL_SECTION_ORDER).toContain("published");
    expect(PANEL_SECTION_ORDER).toContain("closed");
    expect(PANEL_SECTION_ORDER).toContain("filled");
    expect(PANEL_SECTION_ORDER).toContain("cancelled");
  });
});
