# Auditoría de estado actual (videos)

Fecha: 2026-08-07

## Migraciones aplicadas y verificadas (Local = Remote)

| Migración | Contenido |
| --- | --- |
| `20260805000000_fase3_storage_videos.sql` | Tabla `videos`, buckets, RLS, triggers, RPCs de moderación, storage público/privado/miniaturas. |
| `20260806000000_fix_videos_public_read.sql` | Lectura de `public-videos` exige published+ready+distributable (o ser propietario). |
| `20260806010000_admin_videos_select.sql` | Política `videos_select_admin` para `is_platform_admin()`. |

## Invariantes verificados en el código

- [x] Los listados públicos aplican `status='published'` + `processing_status='ready'`
      + `video_is_publicly_distributable(moderation_status)` (además del RLS).
- [x] `unlisted` se excluye de listados públicos.
- [x] Signed URLs solo en servidor, nunca persistidas en BD.
- [x] Publicar no exige aprobación de moderación; las server actions verifican
      estado/objeto y publican de forma atómica (`published` + `ready`).
      Rechazado/marcado queda bloqueado en la distribución (no en su `status`).
- [x] El panel no ofrece acciones imposibles (p. ej. publicar un vídeo `uploading`
      o `rejected`).
- [x] El borrado limpia storage (vídeo + miniatura + portada + captions) y la fila.
- [x] Miniaturas de vídeos protegidos usan signed URL en los listados.
- [x] Navegación admin condicionada a `app_metadata.role === 'admin'`.
- [x] El panel muestra proyecto, organización, fechas de creación/publicación,
      motivo de rechazo y estados de publicación/mod. por tarjeta.
- [x] Reproductor custom con estado propio (loading/ready/error), captions y
      atajos de teclado; sin dependencia de librerías externas.
- [x] La portada desde frame respeta `MAX_IMAGE_UPLOAD_BYTES` (5 MB) y usa
      upsert en la misma ruta determinista del poster.
- [x] `messages/en.json` y `messages/es.json` simétricos (797 claves; `only en`/`only es` vacíos).

## Riesgos / notas

- No se inventan datos ni métricas: el rail de vídeos cortos solo se muestra con
  vídeos verticales reales (dimensiones conocidas).
- No hay migraciones nuevas pendientes; cualquier cambio de esquema requiere
  autorización.
- Sin pruebas destructivas contra producción.
