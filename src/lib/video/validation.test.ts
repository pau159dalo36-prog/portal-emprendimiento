import { describe, expect, test } from "vitest";
import {
  validateCaptionFile,
  validateImageFile,
  validateVideoFile,
  validateVideoMetadata,
} from "@/lib/video/validation";

function fakeFile(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

describe("validateVideoFile", () => {
  test("acepta mp4", () => {
    expect(validateVideoFile(fakeFile("clip.mp4", "video/mp4", 1024))).toBeNull();
  });

  test("rechaza quicktime (no permitido)", () => {
    expect(validateVideoFile(fakeFile("clip.mov", "", 1024))).toBe("badFormat");
  });

  test("rechaza sin archivo", () => {
    expect(validateVideoFile(null)).toBe("noFile");
  });

  test("rechaza archivo demasiado grande", () => {
    expect(validateVideoFile(fakeFile("clip.mp4", "video/mp4", 101 * 1024 * 1024))).toBe(
      "tooLarge",
    );
  });

  test("rechaza formato no permitido", () => {
    expect(validateVideoFile(fakeFile("clip.txt", "text/plain", 1024))).toBe("badFormat");
  });
});

describe("validateVideoMetadata", () => {
  test("acepta duración válida", () => {
    expect(validateVideoMetadata({ durationSeconds: 150 })).toBeNull();
  });

  test("acepta metadatos vacíos", () => {
    expect(validateVideoMetadata({ durationSeconds: null })).toBeNull();
  });

  test("rechaza duración negativa", () => {
    expect(validateVideoMetadata({ durationSeconds: -1 })).toBe("invalidMetadata");
  });

  test("rechaza duración mayor de 3 minutos", () => {
    expect(validateVideoMetadata({ durationSeconds: 181 })).toBe("durationTooLong");
  });
});

describe("validateImageFile", () => {
  test("acepta png", () => {
    expect(validateImageFile(fakeFile("thumb.png", "image/png", 1024))).toBeNull();
  });

  test("rechaza sin archivo", () => {
    expect(validateImageFile(null)).toBe("thumbnailRequired");
  });

  test("rechaza tamaño excesivo", () => {
    expect(validateImageFile(fakeFile("thumb.png", "image/png", 6 * 1024 * 1024))).toBe(
      "thumbnailTooLarge",
    );
  });

  test("rechaza formato no permitido", () => {
    expect(validateImageFile(fakeFile("thumb.gif", "image/gif", 1024))).toBe(
      "thumbnailBadFormat",
    );
  });
});

describe("validateCaptionFile", () => {
  test("acepta vtt", () => {
    expect(validateCaptionFile(fakeFile("subs.vtt", "text/vtt", 1024))).toBeNull();
  });

  test("acepta octet-stream con extensión vtt", () => {
    expect(validateCaptionFile(fakeFile("subs.vtt", "application/octet-stream", 1024))).toBeNull();
  });

  test("rechaza sin archivo", () => {
    expect(validateCaptionFile(null)).toBe("captionRequired");
  });

  test("rechaza formato no permitido", () => {
    expect(validateCaptionFile(fakeFile("subs.srt", "application/x-subrip", 1024))).toBe(
      "captionBadFormat",
    );
  });
});
