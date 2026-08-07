# Arquitectura de vídeos

## Modelo de datos

La publicación se hace directamente sobre la tabla `public.videos`
(no existe `video_publications`). Cada fila combina:

- **Metadatos técnicos**: `storage_bucket`, `storage_path`, `original_filename`,
  `mime_type`, `size_bytes`, `duration_seconds`, `width`, `height`, `aspect_ratio`.
- **Imágenes**: `thumbnail_path/thumbnail_bucket`, `poster_path/poster_bucket`,
  con rutas deterministas `{uid}/{videoId}/{kind}/{kind}.{ext}`.
- **Subtítulos/transcripción**: `captions_path`, `transcript` (sin bucket propio;
  los captions se limpian con el bucket del vídeo).
- **Publicación**: `title`, `caption`, `status` (`draft|published|hidden|removed|archived`),
  `published_at`.
- **Procesado**: `processing_status` (`uploading|uploaded|validating|ready|failed|removed`).
- **Moderación**: `moderation_status` (`pending|approved|rejected|flagged`),
  `moderated_by`, `moderated_at`, `moderation_reason`.
- **Visibilidad**: `visibility` (`public|unlisted|registered_users|project_members|private`).
- **Idioma**: `original_language` (catálogo `video_languages`).

## Clases de visibilidad y buckets

| Clase | Visibilidades | Bucket | Lectura |
| --- | --- | --- | --- |
| Pública | `public`, `unlisted` | `public-videos` | URL pública solo si publicado+ready+approved |
| Protegida | `registered_users`, `project_members`, `private` | `private-videos` | signed URL servidor (`can_access_video_storage`) |

- La clase queda congelada tras completar la subida (`videos_validate_visibility_bucket`).
- Miniaturas/portadas: clase pública → `video-thumbnails`; protegida → `private-videos`
  (trigger `videos_validate_thumbnail_visibility`).

## Invariantes de seguridad

- Lecturas públicas exigen `status='published'` + `processing_status='ready'`
  + `moderation_status='approved'` (RLS y políticas de storage).
- La moderación es solo administrativa: `is_platform_admin()` lee el JWT;
  las RPCs `admin_*_video` son `SECURITY DEFINER`, rechazan moderar vídeos propios
  y el trigger bloquea cualquier cambio de moderación no administrativo.
- Un vídeo solo puede asociarse a un proyecto/organización donde el autor es miembro.
- El propietario no puede cambiar `owner_id`, no puede autoaprobarse, no puede marcar
  `ready` sin publicar, no puede publicar un vídeo no listo y no puede publicar sin
  aprobación de moderación (`moderation_status = 'approved'`).

## Navegación y páginas

- **Portada** (`/[locale]`): `VideoRail` (grid horizontal) y `ShortVideosRail`
  (vídeos verticales reales, solo si `height > width`).
- **Exploración**: `/[locale]/videos` → grid de `VideoCard`.
- **Reproducción** (`/[locale]/videos/[id]`): `VideoPlayer` custom con URL pública o
  signed URL según visibilidad; badges de estado visibles solo para propietario/admin.
- **Panel** (`/[locale]/(app)/panel/videos`): secciones por estado con acciones
  condicionadas (publicar solo si aprobado, retirar/archivar/eliminar) y metadatos
  (proyecto, organización, fechas de creación/publicación, motivo de rechazo).
- **Edición** (`/[locale]/(app)/videos/[id]/editar`): `VideoPublicationForm` +
  `VideoImageUploader` + `VideoCoverGenerator`.
- **Moderación** (`/[locale]/(app)/admin/videos`): `VideoModerationForm` (admin).
- **Integración**: vídeos publicados en proyecto, perfil y organización.

## Reproductor y portada desde frame

- `src/components/video/video-player.tsx` — reproductor custom: play/pause, barra de
  progreso, tiempo actual/duración, volumen/mute, fullscreen, captions (tracks),
  estados loading/ready/error y atajos de teclado (Espacio/k, ←/→ ±5 s, ↑/↓ ±0.1,
  m, f). `preload="metadata"`, sin autoplay, `playsInline`; estado reseteado con
  `onLoadStart` al cambiar de `src`.
- `src/components/video/video-cover-generator.tsx` — genera la portada desde un frame
  del propio vídeo: slider de instante → `loadVideoElement` + `seekVideoTo` +
  `captureVideoFrame` (canvas, WebP con fallback JPEG, máx 1280 px) → preview con
  object URL → subida como `poster` vía `prepareVideoImageUploadAction` +
  `uploadFileToStorage` (upsert) + `saveVideoImagesAction`.
- `src/lib/video/frame.ts` — API de captura (tiempos de espera de 15 s,
  `crossOrigin="anonymous"`), con `extractVideoFrame(file)` para el formulario de subida.

## Fuente principal

- `src/videos/data.ts` — consultas (`listPublishedVideos`, `listPublishedVideosForProject`,
  `listPublishedVideosForOrganization`, `listVideosForUser`, `getVideoById`,
  `listVideosForModeration`) y `isVerticalVideo`.
- `src/actions/videos.ts` — server actions de subida/imágenes/publicación/estado/borrado.
- `src/lib/video/` — helpers puros (`file-names`, `validation`, `upload`, `playback`,
  `preview`, `frame`, `utils` con `formatPlaybackTime`).
- `src/videos/visibility.ts` — clases de visibilidad.
