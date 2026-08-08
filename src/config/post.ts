export const POST_TYPES = [
  "video",
  "text",
  "project_update",
  "opportunity",
  "article",
] as const;

export type PostType = (typeof POST_TYPES)[number];

export const POST_VISIBILITIES = [
  "public",
  "unlisted",
  "registered_users",
  "project_members",
  "private",
] as const;

export type PostVisibility = (typeof POST_VISIBILITIES)[number];

export const POST_PUBLICATION_STATUSES = ["draft", "published", "hidden", "removed"] as const;

export type PostPublicationStatus = (typeof POST_PUBLICATION_STATUSES)[number];

// Proyección de estados distribuibles usada por la capa de aplicación para los
// listados. La distributividad real de los posts de vídeo se DERIVA del vídeo
// (status/processing/moderación + coherencia de visibilidad) mediante el
// predicado SQL `post_is_publicly_distributable`; esta constante alimenta los
// filtros de las consultas de listado (el feed excluye además 'unlisted').
export const POST_DISTRIBUTABLE_PUBLICATION_STATUSES = ["published"] as const;

export const MAX_POST_BODY_LENGTH = 5000;
