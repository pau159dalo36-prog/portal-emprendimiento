# Subida de vídeos

## Flujo

1. **Selección y validación** (`VideoUploadForm`, `validateVideoFileFull`):
   MP4/WebM, ≤ 100 MB, ≤ 180 s; se leen duración y dimensiones.
2. **Creación del borrador** (`createVideoUploadAction`): inserta en `videos`
   como `draft`/`uploading`/`pending`, calcula ruta determinista
   `{uid}/{videoId}/{archivo}.{ext}` y devuelve bucket+ruta.
3. **Subida directa** (`uploadFileToStorage`): XHR con `Authorization` y `x-upsert`,
   progreso real; cada usuario solo escribe en su carpeta `{uid}/...`.
4. **Completado** (`completeVideoUploadAction`): verifica el objeto con
   `storage.info` y marca `processing_status='uploaded'` (nunca `ready`).
5. **Portada automática** (`generateAndSaveCover`): se extrae un frame del vídeo
   (canvas → WebP/JPEG ≤ 1280 px), se sube a `video-thumbnails` o `private-videos`
   según la clase de visibilidad y se persiste vía `saveVideoImagesAction`.
6. **Edición**: título, descripción, idioma, visibilidad (solo dentro de la clase
   congelada), proyecto; miniaturas/portadas con `VideoImageUploader`.
7. **Portada desde frame** (`VideoCoverGenerator`): en edición se puede elegir el
   instante con un slider y generar la portada desde el propio vídeo
   (`loadVideoElement` + `seekVideoTo` + `captureVideoFrame`); se sube como poster
   con upsert (misma ruta determinista) y respeta el límite de 5 MB.
8. **Publicación** (`saveVideoPublicationAction`/`changeVideoStatusAction`):
   verifica el objeto, exige `moderation_status = 'approved'` y publica
   atómicamente `status='published'` + `processing_status='ready'`.
9. **Moderación**: un admin revisa en `/admin/videos` (aprobar/rechazar/marcar).
10. **Borrado** (`deleteVideoAction`): elimina la fila y los objetos de storage
   (vídeo + miniatura + portada + captions si existe).

## Límites

- Vídeo: MP4/WebM · 100 MB · 180 s.
- Imagen: PNG/JPEG/WebP · 5 MB.
- Captions: WebVTT (.vtt) · 1 MB.

## Notas

- Los signed URLs se generan en servidor bajo demanda (`resolvePlaybackUrl`,
  `resolveVideoImagePreviewUrl`) y nunca se persisten en BD.
- `resolveVideoThumbnailUrl` usa URL pública para `video-thumbnails` y signed URL
  para `private-videos`, por lo que los listados muestran miniaturas de vídeos
  protegidos sin romper la visibilidad.
