import { describe, expect, it } from "vitest";

import {
  createImageObjectPath,
  createImageObjectPathForKind,
  createVideoObjectPath,
  isSafeStoragePath,
} from "@/lib/video/file-names";

describe("createVideoObjectPath", () => {
  it("uses the owner folder and the video id", () => {
    expect(createVideoObjectPath("user-123", "video-456", "Presentación.mp4", "tok1")).toBe(
      "user-123/video-456/presentacion-tok1.mp4",
    );
  });

  it("normalizes accents and unsafe characters", () => {
    expect(createVideoObjectPath("u1", "v1", "Mi Vídeo 2026!.MOV", "tok")).toBe(
      "u1/v1/mi-video-2026-tok.mov",
    );
  });

  it("falls back to a generic name when the filename is empty", () => {
    expect(createVideoObjectPath("u1", "v1", "!!!", "tok")).toBe("u1/v1/video-tok");
  });

  it("keeps the extension separated from the unique token", () => {
    const path = createVideoObjectPath("u1", "v1", "demo.webm", "abc123");
    expect(path).toBe("u1/v1/demo-abc123.webm");
  });
});

describe("createImageObjectPath", () => {
  it("builds a thumbnail path under the kind folder", () => {
    expect(createImageObjectPath("u1", "v1", "thumbnail", "portada.png", "tok")).toBe(
      "u1/v1/thumbnail/portada-tok.png",
    );
  });

  it("builds a poster path under the kind folder", () => {
    expect(createImageObjectPath("u1", "v1", "poster", "Portada JPG.jpg", "tok")).toBe(
      "u1/v1/poster/portada-jpg-tok.jpg",
    );
  });
});

describe("createImageObjectPathForKind", () => {
  it("builds a deterministic thumbnail path", () => {
    expect(createImageObjectPathForKind("u1", "v1", "thumbnail", ".png")).toBe(
      "u1/v1/thumbnail/thumbnail.png",
    );
  });

  it("builds a deterministic poster path", () => {
    expect(createImageObjectPathForKind("u1", "v1", "poster", ".webp")).toBe(
      "u1/v1/poster/poster.webp",
    );
  });

  it("normalizes the extension and drops unsafe tokens", () => {
    expect(createImageObjectPathForKind("u1", "v1", "thumbnail", ".PNG")).toBe(
      "u1/v1/thumbnail/thumbnail.png",
    );
    expect(createImageObjectPathForKind("u1", "v1", "thumbnail", "../x")).toBe(
      "u1/v1/thumbnail/thumbnail",
    );
  });
});

describe("isSafeStoragePath", () => {
  it("accepts well-formed bucket-relative paths", () => {
    expect(isSafeStoragePath("u1/video.mp4")).toBe(true);
    expect(isSafeStoragePath("u1/v1/thumbnail/t.png")).toBe(true);
    expect(isSafeStoragePath("u1/v1/mi-video-2026-tok.webm")).toBe(true);
  });

  it("rejects leading or trailing slashes", () => {
    expect(isSafeStoragePath("/u1/video.mp4")).toBe(false);
    expect(isSafeStoragePath("u1/video.mp4/")).toBe(false);
  });

  it("rejects traversal and backslashes", () => {
    expect(isSafeStoragePath("u1/../video.mp4")).toBe(false);
    expect(isSafeStoragePath("u1\\video.mp4")).toBe(false);
    expect(isSafeStoragePath("u1/..")).toBe(false);
  });

  it("rejects empty or oversized paths", () => {
    expect(isSafeStoragePath("")).toBe(false);
    expect(isSafeStoragePath("u1/" + "a".repeat(501))).toBe(false);
  });
});
