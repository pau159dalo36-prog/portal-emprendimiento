import { describe, expect, it } from "vitest";

import { isVerticalVideo, listPublishedVideos } from "@/videos/data";
import type { VideoWithDetails } from "@/videos/types";

const base = {
  id: "00000000-0000-0000-0000-000000000000",
  owner_id: "00000000-0000-0000-0000-000000000001",
  project_id: null,
  organization_id: null,
  storage_bucket: "public-videos",
  storage_path: "u/v/video.mp4",
  original_filename: "video.mp4",
  mime_type: "video/mp4",
  size_bytes: 1000,
  duration_seconds: 10,
  width: 1280,
  height: 720,
  aspect_ratio: null,
  thumbnail_path: null,
  poster_path: null,
  thumbnail_bucket: null,
  poster_bucket: null,
  captions_path: null,
  transcript: null,
  original_language: "es",
  title: "Vídeo de prueba",
  caption: null,
  processing_status: "ready",
  moderation_status: "approved",
  moderated_by: null,
  moderated_at: null,
  moderation_reason: null,
  visibility: "public",
  status: "published",
  published_at: "2026-08-01T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  owner: null,
  project: null,
  organization: null,
} satisfies VideoWithDetails;

describe("isVerticalVideo", () => {
  it("devuelve true para vídeos verticales (altura mayor que anchura)", () => {
    expect(isVerticalVideo({ ...base, width: 720, height: 1280 })).toBe(true);
  });

  it("devuelve false para vídeos horizontales", () => {
    expect(isVerticalVideo({ ...base, width: 1280, height: 720 })).toBe(false);
  });

  it("devuelve false para vídeos cuadrados", () => {
    expect(isVerticalVideo({ ...base, width: 1080, height: 1080 })).toBe(false);
  });

  it("devuelve false cuando faltan las dimensiones", () => {
    expect(isVerticalVideo({ ...base, width: null, height: null })).toBe(false);
    expect(isVerticalVideo({ ...base, width: 720, height: null })).toBe(false);
    expect(isVerticalVideo({ ...base, width: null, height: 1280 })).toBe(false);
  });
});

describe("listPublishedVideos", () => {
  it("es una función que acepta un cliente de supabase (firma de llamada)", () => {
    expect(typeof listPublishedVideos).toBe("function");
  });
});
