import { z } from "zod";
import { POST_PUBLICATION_STATUSES, POST_TYPES, POST_VISIBILITIES } from "@/config/post";
import { MAX_POST_BODY_LENGTH } from "@/posts/constants";

export const postTypeSchema = z.enum(POST_TYPES);
export const postVisibilitySchema = z.enum(POST_VISIBILITIES);
export const postPublicationStatusSchema = z.enum(POST_PUBLICATION_STATUSES);

// Filtros comunes de listado de posts (feed futuro y listados por autor).
export const listPostsFiltersSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  authorId: z.string().uuid().optional(),
});

// `body` queda reservado a los tipos futuros (text, article, ...): para los
// posts de vídeo el contenido vive en `videos.caption` (fuente de verdad única).
export const postBodySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_POST_BODY_LENGTH);
