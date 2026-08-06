# Seguridad

Principios aplicados en todo el proyecto, con foco en la FASE 3 (Storage y vídeos).

## Principios generales

- **Mínimo privilegio**: RLS activado en todas las tablas públicas y grants
  explícitos (el proyecto tiene `auto_expose_new_tables` desactivado).
- **Sin secretos en el repositorio**: `.env.local` está excluida por Git;
  solo `NEXT_PUBLIC_*` se expone al cliente. La `publishable key` se introduce
  manualmente y nunca la `service_role`.
- **Server Actions como frontera**: autorización con `requireUser()` y
  `getClaims()` verificadas; nunca se confía en datos de cookies sin validar.
- **Validación en dos capas**: Zod en el servidor (Server Actions) y
  validaciones de cliente para una buena UX.

## FASE 3 — Storage y vídeos

- **Aislamiento por carpeta**: toda ruta de objeto comienza por
  `<auth.uid()>`. Las políticas de Storage exigen ese primer segmento para
  INSERT/UPDATE/DELETE, de modo que un usuario no puede leer ni sobrescribir
  los ficheros de otro.
- **Bucket privado con signed URLs**: `private-videos` nunca es público. La
  reproducción pasa por `resolvePlaybackUrl`, que genera signed URLs de 1 hora
  con el cliente autenticado (sujeto a RLS) y nunca con `service_role`.
- **Autorización derivada de la BD**: la política de lectura de `private-videos`
  usa `can_access_video_storage` (SECURITY DEFINER) para no duplicar lógica de
  visibilidad en SQL duplicado ni provocar recursión de RLS.
- **Límites de subida conservadores** (plan gratuito):
  - Vídeo: 100 MB, 180 s, `video/mp4` y `video/webm`.
  - Miniatura/póster: 5 MB, `png/jpeg/webp`.
  - Subtítulos: 1 MB, `.vtt`.
  Se aplican tanto en cliente (`src/config/uploads.ts`) como en los buckets
  (`file_size_limit` + `allowed_mime_types`).
- **Bucket público controlado**: `public-videos` y `video-thumbnails` son
  públicos para permitir reproducción/thumbnails sin auth. Riesgo documentado:
  una URL pública permite acceder al objeto; la visibilidad `unlisted` solo
  oculta el vídeo de los listados, no el acceso directo por URL.
- **Clases de visibilidad con bucket obligatorio**: clase pública
  (`public`/`unlisted`) → `public-videos`; clase protegida
  (`registered_users`/`project_members`/`private`) → `private-videos`. Lo
  impone un CHECK de tabla y un trigger que congela bucket y clase al completar
  la subida (y no se puede revertir a `uploading`, por lo que la congelación no
  se puede eludir).
- **Miniaturas con bucket explícito**: las columnas `thumbnail_bucket`/
  `poster_bucket` fijan dónde vive cada imagen. La clase pública solo puede usar
  `video-thumbnails`; la clase protegida solo `private-videos` (o no tener
  imagen). La lectura pública de `video-thumbnails` exige además que el objeto
  esté referenciado por un vídeo publicado, listo y aprobado (o ser del propio
  usuario), de modo que un vídeo pendiente/protegido nunca filtra su portada.
- **Moderación solo administrativa**: `is_platform_admin()` comprueba
  únicamente `app_metadata.role = 'admin'` del JWT y es una función **normal**
  (no `SECURITY DEFINER`), por lo que no eleva privilegios. Las RPCs
  `admin_approve_video`/`admin_reject_video`/`admin_flag_video` verifican el rol
  internamente y registran auditoría (`moderated_by`/`moderated_at`/
  `moderation_reason`). El propietario no puede auto-aprobarse: el trigger
  `videos_validate_state_change` bloquea cualquier cambio de moderación salvo
  que el autor de la sentencia sea un administrador distinto del propietario
  (verificado con `auth.jwt()`; **no** existe ningún guard de transacción
  manipulable por el cliente).
- **Sin proveedores externos**: no se integran Mux/Cloudflare ni se firman
  URLs con claves de servicio.
- **Código nunca introduce secretos**: los paths de Storage se construyen solo
  con UUIDs y nombres normalizados (sin emails ni datos personales).

## Estado y limitaciones conocidas

- La moderación ya **filtra las lecturas**: `videos_select_public`,
  `videos_select_registered`, `videos_select_project_members` y el helper de
  storage exigen `moderation_status='approved'`. Un vídeo pendiente solo lo ve
  su propietario.
- Las signed URLs caducan (1 h); el reproductor debe regenerarlas si expiran
  durante la sesión.
- Los subtítulos/miniaturas aún no tienen UI de subida (ver
  `VIDEO_UPLOADS.md`); sus rutas y buckets (`thumbnail_bucket`/`poster_bucket`)
  quedan preparados en el esquema.

## Enlaces

- Detalle de políticas RLS: [RLS_POLICIES.md](./RLS_POLICIES.md)
- Detalle de políticas de Storage: [STORAGE_POLICIES.md](./STORAGE_POLICIES.md)
- Detalle de subidas y límites: [VIDEO_UPLOADS.md](./VIDEO_UPLOADS.md)
- Arquitectura de vídeo: [VIDEO_ARCHITECTURE.md](./VIDEO_ARCHITECTURE.md)
