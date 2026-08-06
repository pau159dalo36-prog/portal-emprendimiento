import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type DirectUploadResult =
  | { ok: true }
  | { ok: false; error: "aborted" | "network" | "unauthorized" | "server" };

export type DirectUploadOptions = {
  bucket: string;
  path: string;
  file: File;
  accessToken: string;
  upsert?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

export function uploadFileToStorage(options: DirectUploadOptions): Promise<DirectUploadResult> {
  const { bucket, path, file, accessToken, upsert = false, onProgress, signal } = options;
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = `${getSupabaseUrl()}/storage/v1/object/${bucket}/${encodedPath}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", getSupabasePublishableKey());
    xhr.setRequestHeader("x-upsert", String(upsert));
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    const onAbort = () => {
      signal?.removeEventListener("abort", onAbort);
      xhr.abort();
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
        });
      }
    };

    xhr.onabort = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve({ ok: false, error: "aborted" });
    };
    xhr.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve({ ok: false, error: "network" });
    };
    xhr.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
      } else if (xhr.status === 401 || xhr.status === 403) {
        resolve({ ok: false, error: "unauthorized" });
      } else {
        resolve({ ok: false, error: "server" });
      }
    };

    xhr.send(file);
  });
}
