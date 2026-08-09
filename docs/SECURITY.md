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
  esté referenciado por un vídeo publicado, listo y distributable (o ser del
  propio usuario), de modo que un vídeo rechazado, marcado, no publicado o
  protegido nunca filtra su portada.
- **Moderación solo administrativa y post-publicación**: el propietario publica
  sin aprobación previa (`status='published'` + `processing_status='ready'`); la
  moderación actúa después, retirando de la distribución pública cualquier vídeo
  `rejected`/`flagged` (RLS, storage y signed URLs lo bloquean de inmediato, sin
  cambiar `status` ni `published_at`). `is_platform_admin()` comprueba
  únicamente `app_metadata.role = 'admin'` del JWT y es una función **normal**
  (no `SECURITY DEFINER`), por lo que no eleva privilegios. Las RPCs
  `admin_approve_video`/`admin_reject_video`/`admin_flag_video` verifican el rol
  internamente y registran auditoría (`moderated_by`/`moderated_at`/
  `moderation_reason`). El propietario no puede auto-aprobarse: el trigger
  `videos_validate_state_change` bloquea cualquier cambio de moderación salvo
  que el autor de la sentencia sea un administrador distinto del propietario
  (verificado con `auth.jwt()`; **no** existe ningún guard de transacción
  manipulable por el cliente). El predicado canónico
  `video_is_publicly_distributable` es la única fuente de verdad que decide si
  un vídeo publicado se sirve al público.
- **Sin proveedores externos**: no se integran Mux/Cloudflare ni se firman
  URLs con claves de servicio.
- **Código nunca introduce secretos**: los paths de Storage se construyen solo
  con UUIDs y nombres normalizados (sin emails ni datos personales).

## FASE 4.1 — Entidad genérica `posts`

- **Envelope de distribución, no fuente de verdad**: `posts` es un sobre
  genérico distribuible. Para los vídeos, `videos` sigue siendo la única fuente
  de verdad de contenido, visibilidad y estados; el post se sincroniza por
  trigger (`posts_sync_from_video`, idempotente vía `UNIQUE(video_id)`) y su
  distributividad se deriva del vídeo con el predicado canónico
  `post_is_publicly_distributable` (fail-closed). Un vídeo
  `rejected`/`flagged`/retirado/archivado deja de distribuirse al instante a
  través de su post, y un `approved` posterior lo restaura sin re-publicar.
- **Sin duplicados por vídeo**: `UNIQUE(video_id)` + `INSERT ... ON CONFLICT`
  garantizan exactamente un post por vídeo publicado, aunque la publicación se
  repita (idempotencia).
- **No se pueden publicar contenidos ajenos**: el usuario solo crea posts como
  sí mismo (`posts_insert_own` con `auth.uid() = author_id`) y el trigger
  `posts_validate_video_ownership` exige que el post de un vídeo pertenezca a su
  propietario y que `project_id`/`organization_id` coincidan con los del vídeo.
  `video_id` y `author_id` son inmutables.
- **Sin DELETE directo**: no existe política DELETE ni GRANT delete sobre
  `posts`; el ciclo de vida se gestiona por el contenido (cascade al borrar el
  vídeo o el perfil).
- **Sin SECURITY DEFINER nuevo**: los triggers son invoker y el predicado es una
  función normal `STABLE` (`search_path=''`), mismo patrón que
  `video_is_publicly_distributable`. Los únicos SECURITY DEFINER usados son los
  helpers de membresía existentes de FASE 2 (`is_project_member`,
  `is_organization_member`).
- **Privacidad**: `private`/`protected` nunca se distribuyen públicamente;
  `unlisted` solo es accesible por enlace directo y queda fuera de los listados
  del feed (capa de aplicación). `service_role` nunca se usa en el frontend.

## FASE 4.2 — Seguimiento (`profile_follows`, `project_follows`, `organization_follows`)

- **Solo uno mismo puede seguir/deseguir**: cada política (`insert_own` /
  `delete_own`) exige `auth.uid() = follower_id`, y los triggers refuerzan la
  misma invariante en SQL. Los CHECK (`follows_actor_is_follower`,
  `follows_not_self_follow`) cierran la puerta a auto-seguirse y a escrituras
  con actores ajenos, inmutables por RLS.
- **Sin enumeración de seguidores**: no hay política SELECT sobre las tablas de
  follows (ni siquiera el propio usuario puede listar quién sigue a quién). Los
  conteos públicos se sirven solo mediante RPCs `SECURITY DEFINER`
  (`get_*_follow_counts`) que devuelven exclusivamente números; `service_role`
  nunca se usa en el frontend.
- **Los triggers no elevan privilegios**: `project_follows_check`,
  `organization_follows_check`, `profile_follows_check` y
  `profile_blocks_cleanup_follows` son **invoker** (no `SECURITY DEFINER`) y
  validan el rol `authenticated` con `get_claim('app_metadata.role')` del JWT.
  Un trigger invoker depende de la política de INSERT, por lo que un usuario sin
  rol en la sesión no puede crear follows (fail-closed).
- **Saneamiento simétrico de bloqueos**: bloquear a un perfil elimina las
  relaciones de seguimiento en ambas direcciones y el trigger impide que un
  usuario bloqueado vuelva a seguir a quien le bloquea (y viceversa).
- **Fail-closed en los conteos**: una fila inexistente devuelve `0`; los
  triggers solo comprueban la relación `follows_blocked` cuando
  `auth.uid()` no es nulo, de modo que el alta de datos por scripts no queda
  bloqueada.

## Estado y limitaciones conocidas

- La moderación **no bloquea la publicación**, pero **sí filtra las lecturas**:
  `videos_select_public`, `videos_select_registered`, `videos_select_project_members`
  y el helper de storage usan `video_is_publicly_distributable`, que excluye
  `rejected`/`flagged`. Un vídeo rechazado/marcado solo lo ve su propietario.
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
