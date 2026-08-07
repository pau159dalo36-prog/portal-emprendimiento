"use client";

const FRAME_MAX_WIDTH = 1280;
const FRAME_QUALITY = 0.85;
const METADATA_TIMEOUT_MS = 15000;

export type VideoFrameResult = {
  blob: Blob;
  mimeType: string;
  extension: string;
};

export function videoObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeVideoObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function waitForLoadedData(video: HTMLVideoElement): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const onLoaded = () => resolve();
      const onError = () => reject(new Error("video load failed"));
      video.addEventListener("loadeddata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.load();
    }),
    METADATA_TIMEOUT_MS,
    "video metadata timeout",
  );
}

function waitForSeeked(video: HTMLVideoElement): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve) => {
      const onSeeked = () => resolve();
      video.addEventListener("seeked", onSeeked, { once: true });
    }),
    METADATA_TIMEOUT_MS,
    "video seek timeout",
  );
}

/**
 * Carga metadata de un vídeo por URL (signed URL o pública) en un elemento
 * desacoplado con CORS. El elemento se reutiliza para poder saltar a distintos
 * instantes sin recargar el fichero.
 */
export async function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = url;
  await waitForLoadedData(video);
  return video;
}

/** Posiciona el vídeo en un instante concreto y espera a que el frame esté listo. */
export async function seekVideoTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    const target = Math.min(Math.max(seconds, 0), video.duration);
    if (Math.abs(video.currentTime - target) > 0.01) {
      video.currentTime = target;
      await waitForSeeked(video);
    }
  }
}

/**
 * Dibuja el frame actual del vídeo en un canvas y lo codifica como WebP
 * (fallback JPEG), escalado a un máximo de 1280 px de ancho.
 */
export async function captureVideoFrame(video: HTMLVideoElement): Promise<VideoFrameResult> {
  const sourceWidth = video.videoWidth || video.clientWidth || 0;
  const sourceHeight = video.videoHeight || video.clientHeight || 0;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("video dimensions unavailable");
  }

  const scale = Math.min(1, FRAME_MAX_WIDTH / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas 2d unavailable");
  }
  context.drawImage(video, 0, 0, width, height);

  const webpSupported =
    typeof HTMLCanvasElement.prototype.toBlob === "function" &&
    canvas.toDataURL("image/webp").startsWith("data:image/webp");
  const mimeType = webpSupported ? "image/webp" : "image/jpeg";
  const extension = webpSupported ? ".webp" : ".jpg";

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, FRAME_QUALITY);
  });
  if (!blob) {
    throw new Error("frame encoding failed");
  }

  return { blob, mimeType, extension };
}

export async function extractVideoFrame(file: File): Promise<VideoFrameResult> {
  const url = videoObjectUrl(file);
  const video = document.createElement("video");

  try {
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    await waitForLoadedData(video);

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const targetTime = duration > 0 ? Math.min(1, duration / 4) : 0;
    await seekVideoTo(video, targetTime);

    return await captureVideoFrame(video);
  } finally {
    revokeVideoObjectUrl(url);
  }
}
