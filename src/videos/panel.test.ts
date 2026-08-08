import { describe, expect, it } from "vitest";

import {
  canArchiveVideo,
  canDeleteVideo,
  canEditVideo,
  canPublishVideo,
  canRetractVideo,
  canUnarchiveVideo,
  getPanelSection,
  PANEL_SECTION_ORDER,
} from "@/videos/panel";

const base = {
  processing_status: "uploaded",
  status: "draft",
  moderation_status: "unreviewed",
};

describe("getPanelSection", () => {
  it("prioriza el estado de subida por encima de todo", () => {
    expect(getPanelSection({ ...base, processing_status: "uploading" })).toBe("uploading");
    expect(getPanelSection({ ...base, processing_status: "failed" })).toBe("failed");
  });

  it("mapea por estado de publicación", () => {
    expect(getPanelSection({ ...base, status: "published" })).toBe("published");
    expect(getPanelSection({ ...base, status: "hidden" })).toBe("hidden");
    expect(getPanelSection({ ...base, status: "archived" })).toBe("archived");
  });

  it("mapea por estado de moderación", () => {
    expect(getPanelSection({ ...base, moderation_status: "unreviewed" })).toBe("unreviewed");
    expect(getPanelSection({ ...base, moderation_status: "flagged" })).toBe("flagged");
    expect(getPanelSection({ ...base, moderation_status: "rejected" })).toBe("rejected");
    expect(getPanelSection({ ...base, moderation_status: "approved" })).toBe("drafts");
  });

  it("excluye los vídeos retirados del panel", () => {
    expect(getPanelSection({ ...base, status: "removed" })).toBeNull();
  });
});

describe("PANEL_SECTION_ORDER", () => {
  it("incluye todas las secciones sin duplicados", () => {
    expect(PANEL_SECTION_ORDER).toHaveLength(9);
    expect(new Set(PANEL_SECTION_ORDER).size).toBe(PANEL_SECTION_ORDER.length);
  });
});

describe("canPublishVideo", () => {
  it("permite publicar sin aprobación de moderación (publicación post-moderación)", () => {
    expect(canPublishVideo({ ...base, moderation_status: "unreviewed" })).toBe(true);
    expect(canPublishVideo({ ...base, moderation_status: "approved" })).toBe(true);
    expect(canPublishVideo({ ...base, moderation_status: "flagged" })).toBe(true);
    expect(canPublishVideo({ ...base, moderation_status: "rejected" })).toBe(true);
  });

  it("bloquea la publicación durante la subida o tras fallar", () => {
    expect(canPublishVideo({ ...base, processing_status: "uploading" })).toBe(false);
    expect(canPublishVideo({ ...base, processing_status: "failed" })).toBe(false);
  });

  it("bloquea la publicación en estados finales", () => {
    expect(canPublishVideo({ ...base, status: "published" })).toBe(false);
    expect(canPublishVideo({ ...base, status: "hidden" })).toBe(false);
    expect(canPublishVideo({ ...base, status: "archived" })).toBe(false);
    expect(canPublishVideo({ ...base, status: "removed" })).toBe(false);
  });
});

describe("canRetractVideo", () => {
  it("solo permite retirar vídeos publicados", () => {
    expect(canRetractVideo({ ...base, status: "published" })).toBe(true);
    expect(canRetractVideo({ ...base, status: "draft" })).toBe(false);
    expect(canRetractVideo({ ...base, status: "hidden" })).toBe(false);
  });
});

describe("canArchiveVideo", () => {
  it("permite archivar salvo vídeos ya archivados/retirados o en subida/fallidos", () => {
    expect(canArchiveVideo({ ...base, status: "published" })).toBe(true);
    expect(canArchiveVideo({ ...base, status: "draft" })).toBe(true);
    expect(canArchiveVideo({ ...base, status: "archived" })).toBe(false);
    expect(canArchiveVideo({ ...base, status: "removed" })).toBe(false);
    expect(canArchiveVideo({ ...base, processing_status: "uploading" })).toBe(false);
    expect(canArchiveVideo({ ...base, processing_status: "failed" })).toBe(false);
  });
});

describe("canUnarchiveVideo", () => {
  it("solo permite desarchivar vídeos archivados", () => {
    expect(canUnarchiveVideo({ ...base, status: "archived" })).toBe(true);
    expect(canUnarchiveVideo({ ...base, status: "draft" })).toBe(false);
  });
});

describe("canEditVideo / canDeleteVideo", () => {
  it("permiten editar y borrar salvo vídeos retirados", () => {
    expect(canEditVideo({ ...base, status: "removed" })).toBe(false);
    expect(canEditVideo({ ...base, status: "published" })).toBe(true);
    expect(canDeleteVideo({ ...base, status: "removed" })).toBe(false);
    expect(canDeleteVideo({ ...base, status: "draft" })).toBe(true);
  });
});
