export const uploads = {
  avatar: {
    fileName: "avatar.webp",
    maxBytes: 5 * 1024 * 1024,
    maxDimension: 512,
    mimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/avif",
    ] as const,
    bucket: "avatars",
  },
} as const;

export type UploadConfig = typeof uploads;
