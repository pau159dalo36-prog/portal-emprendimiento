import { describe, expect, it } from "vitest";

import {
  canChangeVisibility,
  getBucketForVisibility,
  getVisibilityClass,
  isPubliclyListable,
  isVideoViewableBy,
} from "@/videos/visibility";
import { VIDEO_BUCKET_PRIVATE, VIDEO_BUCKET_PUBLIC } from "@/config/uploads";

describe("getVisibilityClass", () => {
  it("classifica las visibilidades públicas como 'public'", () => {
    expect(getVisibilityClass("public")).toBe("public");
    expect(getVisibilityClass("unlisted")).toBe("public");
  });

  it("classifica las visibilidades protegidas como 'protected'", () => {
    expect(getVisibilityClass("registered_users")).toBe("protected");
    expect(getVisibilityClass("project_members")).toBe("protected");
    expect(getVisibilityClass("private")).toBe("protected");
  });

  it("devuelve null para valores desconocidos", () => {
    expect(getVisibilityClass("")).toBeNull();
    expect(getVisibilityClass("secret")).toBeNull();
  });
});

describe("getBucketForVisibility", () => {
  it("mapea la clase pública al bucket público", () => {
    expect(getBucketForVisibility("public")).toBe(VIDEO_BUCKET_PUBLIC);
    expect(getBucketForVisibility("unlisted")).toBe(VIDEO_BUCKET_PUBLIC);
  });

  it("mapea la clase protegida al bucket privado", () => {
    expect(getBucketForVisibility("registered_users")).toBe(VIDEO_BUCKET_PRIVATE);
    expect(getBucketForVisibility("project_members")).toBe(VIDEO_BUCKET_PRIVATE);
    expect(getBucketForVisibility("private")).toBe(VIDEO_BUCKET_PRIVATE);
  });

  it("devuelve null para valores desconocidos", () => {
    expect(getBucketForVisibility("wat")).toBeNull();
  });
});

describe("canChangeVisibility", () => {
  it("permite cambiar dentro de la misma clase tras completar la subida", () => {
    expect(
      canChangeVisibility({ visibility: "public", processingStatus: "ready" }, "unlisted"),
    ).toBe(true);
    expect(
      canChangeVisibility(
        { visibility: "registered_users", processingStatus: "ready" },
        "project_members",
      ),
    ).toBe(true);
  });

  it("solo permite saltar de clase mientras se está subiendo", () => {
    expect(
      canChangeVisibility({ visibility: "public", processingStatus: "uploading" }, "private"),
    ).toBe(true);
    expect(
      canChangeVisibility({ visibility: "private", processingStatus: "uploading" }, "public"),
    ).toBe(true);
    expect(
      canChangeVisibility({ visibility: "public", processingStatus: "uploaded" }, "private"),
    ).toBe(false);
    expect(
      canChangeVisibility({ visibility: "private", processingStatus: "ready" }, "public"),
    ).toBe(false);
  });

  it("rechaza visibilidades desconocidas", () => {
    expect(
      canChangeVisibility({ visibility: "public", processingStatus: "ready" }, "wat"),
    ).toBe(false);
    expect(
      canChangeVisibility({ visibility: "wat", processingStatus: "uploading" }, "public"),
    ).toBe(false);
  });
});

describe("isPubliclyListable", () => {
  it("solo lista públicamente public y unlisted", () => {
    expect(isPubliclyListable("public")).toBe(true);
    expect(isPubliclyListable("unlisted")).toBe(true);
    expect(isPubliclyListable("registered_users")).toBe(false);
    expect(isPubliclyListable("private")).toBe(false);
  });
});

describe("isVideoViewableBy", () => {
  const video = { owner_id: "owner-1", visibility: "registered_users" };

  it("permite ver las visibilidades públicas sin sesión", () => {
    expect(isVideoViewableBy({ ...video, visibility: "public" }, null)).toBe(true);
  });

  it("exige sesión para el resto", () => {
    expect(isVideoViewableBy(video, null)).toBe(false);
    expect(isVideoViewableBy({ ...video, visibility: "private" }, "someone")).toBe(false);
  });

  it("el propietario siempre puede ver su vídeo", () => {
    expect(isVideoViewableBy(video, "owner-1")).toBe(true);
    expect(isVideoViewableBy({ ...video, visibility: "private" }, "owner-1")).toBe(true);
  });

  it("los usuarios registrados ven registered_users", () => {
    expect(isVideoViewableBy(video, "anyone")).toBe(true);
  });
});
