# Arquitectura de vídeo

## Visión general

FASE 3 habilita la subida de vídeos desde el navegador directamente a Supabase
Storage (sin servicios externos de transcodificación/streaming) y su publicación
como contenido del portal. La publicación se modela **directamente sobre la
tabla `videos`** (columnas `title`, `caption`, `status`, `published_at`); no
existe una tabla separada de publicaciones (`video_publications` fue descartada
para mantener un único registro por vídeo, coherente con el modelo de la
FASE 4 para `posts`).

## Capas de código

| Capa                        | Ficheros                                                      | Responsabilidad                                       |
| --------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| Configuración de límites    | `src/config/uploads.ts`                                       | Tamaños, duración, MIME y buckets (fuente de verdad)  |
| Constantes de dominio       | `src/config/video.ts`, `src/videos/constants.ts`              | Estados, visibilidades, idiomas, longitudes           |
| Abstracción de storage      | `src/lib/video/video-provider.ts`, `src/lib/video/types.ts`   | Interfaz `VideoProvider` y tipos de referencia        |
| Implementación Supabase     | `src/lib/video/supabase-video-provider.ts`                    | URLs públicas vs. signed URLs (1 h)                   |
| Utilidades y validación     | `src/lib/video/utils.ts`, `src/lib/video/validation.ts`       | Normalización de nombres, rutas `<uid>/<videoId>/…`, MIME real, metadatos |
| Capa de datos               | `src/videos/data.ts`, `src/videos/types.ts`, `src/videos/map.ts` | Consultas Supabase y tipos con detalles (owner/proyecto) |
| Server Actions              | `src/actions/videos.ts`                                       | Guardar borrador, guardar/publicar, cambiar estado, borrar |
| Validación (Zod)            | `src/validations/video.ts`                                    | Título, descripción, idioma, visibilidad, proyecto    |
| UI                          | `src/components/video/*`                                      | Subida, formulario, tarjeta, reproductor, listas      |
| Páginas                     | `src/app/[locale]/videos/**`, `src/app/[locale]/(app)/panel/videos/**`, `src/app/[locale]/(app)/publicar/video/**` | Listado, detalle, edición, panel y subida |

## Modelo de datos

### `videos`

| Columna            | Tipo           | Descripción                                                     |
| ------------------ | -------------- | --------------------------------------------------------------- |
| id                 | UUID (PK)      | Identificador del vídeo (y de la URL `/videos/[id]`)            |
| owner_id           | UUID (FK)      | `profiles.id`, cascade                                          |
| project_id         | UUID (FK)      | `projects.id`, `on delete set null`                             |
| storage_bucket     | TEXT           | `public-videos` o `private-videos`                              |
| storage_path       | TEXT           | Ruta del objeto `<uid>/<videoId>/<archivo>`                     |
| original_filename  | TEXT           | Nombre original del fichero                                     |
| mime_type          | TEXT           | `video/mp4`, `video/webm` (CHECK `video/%`)                     |
| size_bytes         | BIGINT         | Tamaño en bytes (`>= 0`)                                        |
| duration_seconds   | INTEGER        | Duración (`>= 0` o NULL), máx. 180 s a nivel de app             |
| width / height     | INTEGER        | Dimensiones (amabas o NULL)                                     |
| aspect_ratio       | TEXT           | Formato `NNNN:NNNN`                                             |
| thumbnail_path     | TEXT           | Miniatura (ruta del objeto)                                  |
| poster_path        | TEXT           | Póster (ruta del objeto)                                     |
| thumbnail_bucket   | TEXT           | Bucket de la miniatura: `video-thumbnails` (pública) o `private-videos` |
| poster_bucket      | TEXT           | Bucket del póster (ídem)                                     |
| captions_path      | TEXT           | Subtítulos (.vtt)                                            |
| transcript         | TEXT           | Transcripción                                                   |
| original_language  | TEXT           | Código ISO `es`/`en`                                            |
| title              | TEXT           | Título de publicación (2–120 caracteres)                        |
| caption            | TEXT           | Descripción (≤ 2000 caracteres)                                 |
| processing_status  | TEXT           | `uploading, uploaded, validating, ready, failed, removed`       |
| moderation_status  | TEXT           | `pending, approved, rejected, flagged` (solo admin)             |
| moderated_by       | UUID (FK)      | `profiles.id`, `on delete set null` (auditoría)                 |
| moderated_at       | TIMESTAMPTZ    | Cuándo se moderó (auditoría)                                    |
| moderation_reason  | TEXT           | Motivo de rechazo/flag (≤ 500)                                  |
| visibility         | TEXT           | `public, unlisted, registered_users, project_members, private`  |
| status             | TEXT           | `draft, published, hidden, removed, archived`                   |
| published_at       | TIMESTAMPTZ    | Sincronizado por trigger con `status = 'published'`             |
| created_at         | TIMESTAMPTZ    |                                                                 |
| updated_at         | TIMESTAMPTZ    | Actualizado por trigger                                         |

Unicidad `(storage_bucket, storage_path)` evita duplicar el mismo objeto.

Restricciones de clase/visibilidad:
- CHECK `videos_bucket_visibility_check`: clase pública → `public-videos`;
  clase protegida → `private-videos` (no se pueden mezclar).
- Trigger `videos_validate_visibility_bucket`: tras completar la subida
  (`processing_status <> 'uploading'`) el bucket y la clase quedan congelados;
  el trigger `videos_validate_state_change` impide además revertir a
  `uploading`, cerrando la vía de eludir la congelación.
- Trigger `videos_validate_thumbnail_visibility`: la clase pública
  (`public`/`unlisted`) solo puede usar el bucket `video-thumbnails`; la clase
  protegida solo `private-videos` o ninguna imagen. La política de SELECT de
  `video-thumbnails` solo sirve objetos referenciados por un vídeo publicado,
  listo y aprobado de clase pública (o del propio usuario).
- Auditoría: CHECK `videos_moderation_audit_check` (`moderated_by` implica
  `moderated_at`) y `videos_moderation_state_check` (los vídeos no pendientes
  siempre tienen `moderated_at`).

### `video_languages` (catálogo)

Códigos ISO de idioma de origen (`es`, `en`), lectura pública, solo consulta.

## Ciclo de vida de un vídeo

```
Subida (borrador)            Publicación              Retirada
─────────────────            ────────────             ──────────
status='draft'               status='published'       status='hidden'/'archived'
processing='uploading'       processing='ready'       published_at=NULL
moderation='pending'         published_at=now()       (la visibilidad NO se altera)
→ 'uploaded'/'validating'
→ 'ready' al publicar
```

- `saveVideoDraftAction`: crea la fila `videos` tras subir el objeto a Storage
  (título provisional derivado del nombre del fichero, `status = 'draft'`). El
  bucket se elige según la clase de visibilidad.
- `saveVideoPublicationAction`: actualiza `title/caption/language/visibility/
  project_id` y, si el intento es publicar, fija `status='published'` y
  `processing_status='ready'`. Valida que la visibilidad elegida coincida con la
  clase del vídeo subido.
- `changeVideoStatusAction`: publicado/oculto/archivado desde el panel. Ocultar
  o archivar ya **no cambia** la visibilidad (la clase queda congelada).
- `deleteVideoAction`: borra la fila y limpia los objetos de Storage (vídeo +
  miniatura + póster).

## Provider de storage (`VideoProvider`)

Interfaz desacoplada en `src/lib/video/video-provider.ts` para poder sustituir
Supabase por un proveedor externo (Mux, Cloudflare Stream) en el futuro:

```ts
interface VideoProvider {
  videoPublicBucket: string;
  videoPrivateBucket: string;
  thumbnailsBucket: string;
  chooseVideoBucket(visibility): string;          // public/unlisted → público
  getPublicUrl(ref): string;                       // URL directa pública
  resolvePlaybackUrl(ref, visibility): Promise<string>; // signed URL si es privado
}
```

`SupabaseVideoProvider` (`src/lib/video/supabase-video-provider.ts`):
- `public`/`unlisted` → URL pública.
- Resto (privado/miembros) → signed URL de **1 hora** (`createSignedUrl`),
  sujeta a la política RLS de `storage.objects`.

## Flujo de reproducción

1. `getVideoById` resuelve la fila (RLS filtra por visibilidad/estado).
2. `provider.resolvePlaybackUrl` devuelve la URL pública o firmada.
3. `VideoPlayer` reproduce con póster (miniatura).

## Decisiones de diseño

- **Sin `video_publications`**: publicar directamente en `videos` simplifica el
  modelo (una fila = un vídeo publicado o borrador) y evita joins.
- **Bucket por visibilidad**: clase pública (`public`/`unlisted`) en
  `public-videos`; clase protegida en `private-videos` con signed URLs. El CHECK
  y el trigger impiden mezclar bucket/clase.
- **Moderación solo admin**: `is_platform_admin()` (JWT `app_metadata.role`,
  función invoker sin elevación de privilegios) y RPCs
  `admin_approve_video`/`admin_reject_video`/`admin_flag_video` con auditoría.
  El trigger bloquea la moderación salvo admin no propietario (sin guards de
  sesión manipulables). El propietario no puede auto-aprobarse.
- **Paths con `auth.uid()` como primer segmento** (`<uid>/<videoId>/…`): las
  políticas de Storage restringen cada usuario a su carpeta.
- **Helper `SECURITY DEFINER`** `can_access_video_storage` para las políticas de
  storage privado, evitando recursión de RLS con `videos`.
- **Límites conservadores** (plan gratuito): 100 MB, 180 s, mp4/webm; miniaturas
  5 MB (png/jpeg/webp); subtítulos 1 MB.
