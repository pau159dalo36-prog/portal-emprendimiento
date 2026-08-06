# Subida de vídeos

## Límites (fuente de verdad: `src/config/uploads.ts`)

| Concepto            | Valor        | Observación                                        |
| ------------------- | ------------ | -------------------------------------------------- |
| Tamaño máximo vídeo | **100 MB**   | `MAX_VIDEO_UPLOAD_MB` (≈ `104857600` bytes)        |
| Duración máxima     | **180 s**    | `MAX_VIDEO_DURATION_SECONDS` (3 minutos)           |
| Formatos de vídeo   | `video/mp4`, `video/webm` | `ALLOWED_VIDEO_MIME_TYPES`         |
| Tamaño máximo imagen (miniatura/póster) | **5 MB** | `MAX_IMAGE_UPLOAD_MB`                 |
| Formatos de imagen  | `image/png`, `image/jpeg`, `image/webp` | `ALLOWED_IMAGE_MIME_TYPES` |
| Tamaño máximo subtítulos | **1 MB**  | `MAX_CAPTION_FILE_MB` (`.vtt`)                      |

Estos mismos límites se configuran en los buckets de Storage (ver
[`STORAGE_POLICIES.md`](./STORAGE_POLICIES.md)):

- `public-videos` y `private-videos`: `file_size_limit = 104857600`,
  `allowed_mime_types = ['video/mp4', 'video/webm']`.
- `video-thumbnails`: `file_size_limit = 5242880`,
  `allowed_mime_types = ['image/png', 'image/jpeg', 'image/webp']`.

## Flujo de subida (cliente)

1. El usuario selecciona un archivo en `VideoUploadDropzone`.
2. `validateVideoFile` comprueba tamaño y MIME real (`normalizeMime`). Si el
   navegador no reporta tipo, se infiere desde la extensión (`.mp4`, `.webm`).
3. `extractVideoMetadata` lee duración y dimensiones con un `<video>` oculto
   (solo para `video/mp4` y `video/webm`); `validateVideoMetadata` aplica el
   límite de 180 s.
4. Se genera `videoId = crypto.randomUUID()` y la ruta
   `generateVideoObjectPath(userId, videoId, filename)` →
   `<userId>/<videoId>/<archivo-normalizado>`.
5. `provider.chooseVideoBucket(visibility)` elige bucket según la clase:
   `public`/`unlisted` → `public-videos`, el resto → `private-videos`.
6. `supabase.storage.from(bucket).upload(path, file)`.
7. `saveVideoDraftAction` inserta la fila en `videos` (`status='draft'`) y
   redirige a `/videos/[id]/editar`. El bucket y la visibilidad deben ser
   coherentes (clase ↔ bucket); el CHECK `videos_bucket_visibility_check` lo
   garantiza en BD.
8. El usuario completa título/descripción y publica con
   `saveVideoPublicationAction`. El formulario solo ofrece opciones de la misma
   clase que el vídeo ya subido; para cambiar de clase hay que re-subir.

## Errores de validación

| Clave                   | Significado                                  |
| ----------------------- | -------------------------------------------- |
| `noFile`                | No se seleccionó archivo o está vacío        |
| `tooLarge`              | Supera 100 MB                                |
| `badFormat`             | MIME no permitido (no mp4/webm)              |
| `invalidMetadata`       | Duración no finita o negativa                |
| `durationTooLong`       | Supera 180 s                                 |
| `thumbnailRequired`     | Falta la miniatura                           |
| `thumbnailTooLarge`     | Imagen > 5 MB                                |
| `thumbnailBadFormat`    | Imagen no permitida                          |
| `captionRequired`       | Falta el subtítulo                           |
| `captionTooLarge`       | Subtítulo > 1 MB                             |
| `captionBadFormat`      | No es `.vtt`                                 |

Los mensajes se resuelven en `videoValidation` (i18n ES/EN).

## Rutas generadas

| Tipo           | Patrón                              | Ejemplo                               |
| -------------- | ----------------------------------- | ------------------------------------- |
| Vídeo          | `<uid>/<videoId>/<archivo>`         | `abc/…/video-id/intro.mp4`            |
| Miniatura      | `<uid>/<videoId>/thumbnail/<img>`   | `abc/…/thumbnail/thumb.png`           |
| Póster         | `<uid>/<videoId>/poster/<img>`      | `abc/…/poster/poster.webp`            |

## Subidas futuras (miniaturas/subtítulos)

La UI actual publica el vídeo directamente desde el formulario de subida. Las
miniaturas (`thumbnail_path`/`poster_path`) y subtítulos (`captions_path`) se
almacenan como rutas en `videos`; su subida será parte de la edición avanzada y
debe respetar los mismos paths y límites. Los subtítulos se guardarán en el
bucket correspondiente al vídeo (preferentemente `private-videos` para vídeos
privados). Las imágenes de la clase pública (`public`/`unlisted`) viven en
`video-thumbnails`; las de la clase protegida en `private-videos` (o no tener
imagen): lo exige el trigger `videos_validate_thumbnail_visibility` mediante
`thumbnail_bucket`/`poster_bucket`, y la lectura pública de `video-thumbnails`
exige que el objeto pertenezca a un vídeo publicado/listo/aprobado.
