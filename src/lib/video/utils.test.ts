import { describe, expect, test } from "vitest";
import {
  formatDurationSeconds,
  formatPlaybackTime,
  generateImageObjectPath,
  generateVideoObjectPath,
  getPublicObjectUrl,
  getVideoImageUrl,
  normalizeFilename,
} from "@/lib/video/utils";

describe("formatDurationSeconds", () => {
  test("devuelve m:ss para menos de una hora", () => {
    expect(formatDurationSeconds(65)).toBe("1:05");
  });

  test("devuelve h:mm:ss para una hora o más", () => {
    expect(formatDurationSeconds(3661)).toBe("1:01:01");
  });

  test("redondea los segundos", () => {
    expect(formatDurationSeconds(59.6)).toBe("1:00");
  });

  test("devuelve cadena vacía para valores inválidos", () => {
    expect(formatDurationSeconds(null)).toBe("");
    expect(formatDurationSeconds(undefined)).toBe("");
    expect(formatDurationSeconds(-1)).toBe("");
    expect(formatDurationSeconds(Number.NaN)).toBe("");
  });
});

describe("formatPlaybackTime", () => {
  test("devuelve m:ss para menos de una hora", () => {
    expect(formatPlaybackTime(65)).toBe("1:05");
    expect(formatPlaybackTime(0)).toBe("0:00");
  });

  test("devuelve h:mm:ss para una hora o más", () => {
    expect(formatPlaybackTime(3661)).toBe("1:01:01");
  });

  test("trunca los segundos (no redondea)", () => {
    expect(formatPlaybackTime(59.9)).toBe("0:59");
  });

  test("devuelve 0:00 para valores inválidos", () => {
    expect(formatPlaybackTime(null)).toBe("0:00");
    expect(formatPlaybackTime(undefined)).toBe("0:00");
    expect(formatPlaybackTime(-1)).toBe("0:00");
    expect(formatPlaybackTime(Number.NaN)).toBe("0:00");
  });
});

describe("normalizeFilename", () => {
  test("convierte espacios y acentos", () => {
    expect(normalizeFilename("Mi Vídeo Demo.mp4")).toBe("mi-video-demo.mp4");
  });

  test("no colapsa guiones interiores pero elimina los del principio", () => {
    expect(normalizeFilename("---hola---.mp4")).toBe("hola---.mp4");
  });

  test("devuelve 'video' si el nombre queda vacío", () => {
    expect(normalizeFilename("   ")).toBe("video");
  });
});

describe("generateVideoObjectPath", () => {
  test("compone la ruta con usuario y vídeo", () => {
    expect(generateVideoObjectPath("user-1", "video-1", "Intro.mp4")).toBe(
      "user-1/video-1/intro.mp4",
    );
  });
});

describe("generateImageObjectPath", () => {
  test("compone la ruta para miniatura y póster", () => {
    expect(generateImageObjectPath("user-1", "video-1", "thumbnail", "thumb.png")).toBe(
      "user-1/video-1/thumbnail/thumb.png",
    );
    expect(generateImageObjectPath("user-1", "video-1", "poster", "p.jpg")).toBe(
      "user-1/video-1/poster/p.jpg",
    );
  });
});

describe("getPublicObjectUrl", () => {
  test("construye la URL pública del objeto", () => {
    expect(getPublicObjectUrl("https://x.supabase.co", "videos", "a/b.mp4")).toBe(
      "https://x.supabase.co/storage/v1/object/public/videos/a/b.mp4",
    );
  });
});

describe("getVideoImageUrl", () => {
  test("usa el bucket indicado", () => {
    expect(getVideoImageUrl("https://x.supabase.co", "video-thumbnails", "a/thumb.png")).toBe(
      "https://x.supabase.co/storage/v1/object/public/video-thumbnails/a/thumb.png",
    );
  });

  test("devuelve null sin ruta", () => {
    expect(getVideoImageUrl("https://x.supabase.co", "video-thumbnails", null)).toBeNull();
  });

  test("devuelve null sin bucket", () => {
    expect(getVideoImageUrl("https://x.supabase.co", null, "a/thumb.png")).toBeNull();
  });
});
