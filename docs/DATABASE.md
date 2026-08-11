# Base de datos

## Estrategia

Se utiliza Supabase como backend de base de datos (PostgreSQL 17). Todas las tablas se definen mediante migraciones SQL versionadas en `supabase/migrations/` y se aplican con `supabase db push`.

## Flujo code-first

```
1. Escribir migración SQL en supabase/migrations/
2. npm run supabase:db:push        → aplica la migración al proyecto remoto
3. npm run supabase:types          → regenera src/types/database.types.ts
4. npm run typecheck / build       → el código consume los tipos generados
```

## Esquema aplicado (Día 1)

### `profiles`
| Columna                   | Tipo         | Descripción                                   |
| ------------------------- | ------------ | --------------------------------------------- |
| id                        | UUID (PK)    | Vinculado a `auth.users.id` (on delete cascade) |
| username                  | TEXT (único, nullable) | Normalizado en minúsculas (trigger), 3-30 caracteres, `[a-z0-9_-]` |
| full_name                 | TEXT         | Nombre público                                |
| headline                  | TEXT         | Titular corto                                 |
| bio                       | TEXT         | Breve descripción                             |
| avatar_url                | TEXT         | URL del avatar (bucket `avatars`)             |
| location                  | TEXT         | Ubicación                                     |
| user_types                | TEXT[]       | `emprendedor, colaborador, mentor, profesional, inversor, empresa, institucion` |
| weekly_availability       | INTEGER      | Entre 0 y 168 horas                           |
| collaboration_preferences | TEXT[]       | `remunerado, participacion, intercambio, voluntario, cofundador, no_disponible` |
| website_url               | TEXT         | URL válida (`http(s)://`) o NULL              |
| linkedin_url              | TEXT         | URL válida (`http(s)://`) o NULL              |
| is_public                 | BOOLEAN      | Default `true`                                |
| onboarding_completed      | BOOLEAN      | Default `false`                               |
| created_at                | TIMESTAMPTZ  |                                                |
| updated_at                | TIMESTAMPTZ  | Actualizado automáticamente por trigger       |

### `skills`
| Columna    | Tipo        | Descripción        |
| ---------- | ----------- | ------------------ |
| id         | UUID (PK)   |                    |
| name       | TEXT (único)| Nombre             |
| slug       | TEXT (único)| Identificador      |
| created_at | TIMESTAMPTZ |                    |

Contiene una semilla inicial de 15 habilidades (desarrollo web/móvil, IA, diseño UX/UI, marketing, ventas, finanzas, fiscalidad, legal, operaciones, producto, gestión de proyectos, e-commerce, industria, sostenibilidad).

### `profile_skills`
| Columna    | Tipo     | Descripción                  |
| ---------- | -------- | ---------------------------- |
| profile_id | UUID (FK)| Referencia a `profiles.id` (cascade) |
| skill_id   | UUID (FK)| Referencia a `skills.id` (cascade)   |
| level      | SMALLINT | Opcional, entre 1 y 5        |
> PK compuesta: (profile_id, skill_id)

### `profile_interests`
| Columna    | Tipo        | Descripción                          |
| ---------- | ----------- | ------------------------------------ |
| id         | UUID (PK)   |                                      |
| profile_id | UUID (FK)   | Referencia a `profiles.id` (cascade) |
| name       | TEXT        | Interés (sin duplicados por perfil, ignorando mayúsculas) |
| created_at | TIMESTAMPTZ |                                      |

## Triggers

| Trigger                    | Tabla       | Comportamiento                                   |
| -------------------------- | ----------- | ------------------------------------------------ |
| `on_auth_user_created`     | `auth.users`| Crea un perfil mínimo al registrarse (`full_name` desde `raw_user_meta_data`) |
| `profiles_set_updated_at`  | `profiles`  | Actualiza `updated_at` en cada UPDATE            |
| `profiles_normalize_username` | `profiles` | Normaliza `username` a minúsculas               |
| `profiles_prevent_id_change`  | `profiles` | Rechaza cambios de `id`                         |

Todas las funciones de trigger usan `security definer` y `set search_path = ''`.

## Row Level Security

RLS está activado en las cuatro tablas públicas. El proyecto tiene `auto_expose_new_tables` desactivado, por lo que se conceden explícitamente los permisos mínimos (`GRANT`) y el RLS filtra filas.

| Tabla             | Operación | Política                    | Protege                                                |
| ----------------- | --------- | --------------------------- | ------------------------------------------------------ |
| `profiles`        | SELECT    | `profiles_select_public`    | Cualquiera lee perfiles públicos (`is_public = true`)  |
| `profiles`        | SELECT    | `profiles_select_own`       | El propietario lee siempre su perfil                   |
| `profiles`        | UPDATE    | `profiles_update_own`       | Solo el propietario; el `WITH CHECK` impide cambiar `id` |
| `profiles`        | INSERT/DELETE | (sin política)          | No hay escrituras anónimas ni borrados vía API         |
| `skills`          | SELECT    | `skills_select_all`         | Lectura pública                                        |
| `skills`          | INSERT/UPDATE/DELETE | (sin política y sin GRANT) | Ningún usuario normal modifica habilidades   |
| `profile_skills`  | SELECT    | `profile_skills_select_public` | Lectura pública solo si el perfil asociado es público |
| `profile_skills`  | SELECT    | `profile_skills_select_own` | El propietario lee siempre las suyas                  |
| `profile_skills`  | INSERT    | `profile_skills_insert_own` | Solo el propietario (`profile_id = auth.uid()`)       |
| `profile_skills`  | UPDATE    | `profile_skills_update_own` | Solo el propietario                                   |
| `profile_skills`  | DELETE    | `profile_skills_delete_own` | Solo el propietario                                   |
| `profile_interests` | SELECT/INSERT/UPDATE/DELETE | Mismas 5 políticas que `profile_skills` | Ídem                            |

## Storage — bucket `avatars`

- Público, límite de **5 MB** (`file_size_limit = 5242880`).
- Formatos permitidos: PNG, JPEG, WebP, GIF, AVIF.
- Políticas en `storage.objects`:
  - `avatars_public_read`: lectura pública.
  - `avatars_insert_own` / `avatars_update_own` / `avatars_delete_own`: cada usuario solo opera dentro de la carpeta `{auth.uid()}`; no puede sobrescribir archivos de otros usuarios.

## Índices

- `profiles_username_lower_unique`: unicidad de username insensible a mayúsculas (`lower(username)`).
- `profiles_username_idx`: búsquedas por username.
- `profiles_is_public_idx`: filtros de perfiles públicos.
- `profile_skills_skill_id_idx`: búsquedas inversas por habilidad.
- `profile_interests_profile_id_idx`: consultas por usuario.
- `profile_interests_profile_name_lower_unique`: sin duplicados de interés por perfil (case-insensitive).

## FASE 3 — Storage y vídeos

### `videos`

Un solo registro por vídeo que combina metadatos del fichero y la publicación
(no existe `video_publications`).

| Columna            | Tipo        | Descripción                                                     |
| ------------------ | ----------- | --------------------------------------------------------------- |
| id                 | UUID (PK)   | Identificador del vídeo (URL `/videos/[id]`)                    |
| owner_id           | UUID (FK)   | `profiles.id` (cascade)                                         |
| project_id         | UUID (FK)   | `projects.id` (on delete set null)                              |
| storage_bucket     | TEXT        | `public-videos` o `private-videos` (CHECK)                      |
| storage_path       | TEXT        | Ruta `<uid>/<videoId>/<archivo>`; única con `storage_bucket`    |
| original_filename  | TEXT        | Nombre original                                                 |
| mime_type          | TEXT        | `video/%` (CHECK)                                               |
| size_bytes         | BIGINT      | `>= 0` (CHECK)                                                  |
| duration_seconds   | INTEGER     | `>= 0` o NULL (CHECK)                                           |
| width / height     | INTEGER     | Ambas o NULL (CHECK)                                            |
| aspect_ratio       | TEXT        | `NNNN:NNNN` (CHECK)                                             |
| thumbnail_path / poster_path | TEXT | Rutas de la imagen |
| thumbnail_bucket / poster_bucket | TEXT | Bucket de la imagen: `video-thumbnails` (clase pública) o `private-videos` (clase protegida) (CHECK) |
| captions_path      | TEXT        | Subtítulos (.vtt)                                               |
| transcript         | TEXT        | Transcripción                                                   |
| original_language  | TEXT        | `es`/`en` (CHECK ISO)                                           |
| title              | TEXT        | 2–120 caracteres (CHECK)                                        |
| caption            | TEXT        | ≤ 2000 caracteres (CHECK)                                       |
| processing_status  | TEXT        | `uploading/uploaded/validating/ready/failed/removed` (CHECK)    |
| moderation_status  | TEXT        | `unreviewed/approved/rejected/flagged` (CHECK); default `unreviewed` |
| moderated_by       | UUID (FK)   | `profiles.id` (on delete set null), auditoría                   |
| moderated_at       | TIMESTAMPTZ | Auditoría de moderación                                         |
| moderation_reason  | TEXT        | Motivo de rechazo/flag, ≤ 500 (CHECK)                           |
| visibility         | TEXT        | `public/unlisted/registered_users/project_members/private`      |
| status             | TEXT        | `draft/published/hidden/removed/archived` (CHECK)               |
| published_at       | TIMESTAMPTZ | Sincronizado por trigger con `status='published'`               |
| created_at         | TIMESTAMPTZ  |                                                                 |
| updated_at         | TIMESTAMPTZ  | Actualizado por trigger                                         |

Índices: `videos_owner_id_idx`, `videos_project_id_idx`,
`videos_visibility_idx`, `videos_processing_status_idx`, `videos_status_idx`,
`videos_listing_idx (status, visibility, processing_status, published_at desc)`,
`videos_published_at_idx`.

Triggers: `videos_set_updated_at` (updated_at), `videos_prevent_id_change`
(protege `id`), `videos_sync_published_at` (fija/limpia `published_at`),
`videos_validate_state_change` (ciclo de vida + bloqueo de moderación admin y
de revertir a `uploading`), `videos_validate_visibility_bucket` (congela
bucket/clase tras subir), `videos_validate_thumbnail_visibility` (bucket de
imagen obligatorio según clase).

CHECKs de clase/moderación: `videos_bucket_visibility_check` (clase ↔ bucket),
`videos_moderation_audit_check`, `videos_moderation_state_check`,
`videos_moderation_reason_length`, `videos_thumbnail_bucket_check`,
`videos_poster_bucket_check`, `videos_thumbnail_bucket_presence_check`,
`videos_poster_bucket_presence_check`.

Funciones de moderación (SECURITY DEFINER, `search_path=''`):
`admin_approve_video(uuid)`, `admin_reject_video(uuid, text)`,
`admin_flag_video(uuid, text)`. La clasificación de visibilidad se centraliza en
`video_visibility_class(text)`, y `is_platform_admin()` (JWT
`app_metadata.role='admin'`) es una función **invoker** (sin elevación de
privilegios) usada por los triggers de validación. El predicado de distribución
`video_is_publicly_distributable(text)` (true salvo `rejected`/`flagged`) se usa
en RLS, storage y `can_access_video_storage`: la publicación no exige aprobación;
la moderación es post-publicación.

### `video_languages`

Catálogo de idiomas de origen (`es`, `en`), solo lectura pública (RLS
`video_languages_select_all`).

### RLS de vídeos

Ver [`RLS_POLICIES.md`](./RLS_POLICIES.md). Las lecturas públicas requieren
`status='published'`, `processing_status='ready'` y
`video_is_publicly_distributable(moderation_status)`; el propietario siempre ve
sus filas.

### Storage — buckets de vídeo

| Bucket             | Público | Límite | MIME                          |
| ------------------ | ------- | ------ | ----------------------------- |
| `public-videos`    | Sí      | 100 MB | `video/mp4`, `video/webm`     |
| `private-videos`   | No      | 100 MB | `video/mp4`, `video/webm`     |
| `video-thumbnails` | Sí      | 5 MB   | `image/png`, `image/jpeg`, `image/webp` |

Políticas de aislamiento por carpeta `<auth.uid()>/…` y signed URLs para el
bucket privado. `video-thumbnails` solo sirve por URL pública objetos
referenciados por un vídeo publicado/listo/distributable de clase pública (o del
propio usuario). Detalle en [`STORAGE_POLICIES.md`](./STORAGE_POLICIES.md).

## FASE 4.1 — Entidad genérica `posts`

Capa base distribuible sobre la que se construirán el feed, los vídeos, los
proyectos, los perfiles, las organizaciones, los comentarios, las reacciones,
los guardados, el empleo y las comunidades. `videos` sigue siendo la fuente de
verdad del contenido audiovisual y de su visibilidad/estados; `posts` es un
sobre (envelope) genérico de distribución que apunta a un vídeo como mucho.

### `posts`

| Columna            | Tipo        | Descripción                                                          |
| ------------------ | ----------- | -------------------------------------------------------------------- |
| id                 | UUID (PK)   | Identificador del post                                               |
| author_id          | UUID (FK)   | `profiles.id` (cascade); el autor debe ser el propietario del vídeo  |
| post_type          | TEXT        | `video/text/project_update/opportunity/article` (CHECK)              |
| body               | TEXT        | Opcional, 1–5000 (CHECK); `NULL` para posts de vídeo (fuente única)  |
| video_id           | UUID (FK)   | `videos.id` (cascade), **UNIQUE** → un solo post por vídeo           |
| project_id         | UUID (FK)   | `projects.id` (set null); debe coincidir con el del vídeo si lo hay  |
| organization_id    | UUID (FK)   | `organizations.id` (set null); ídem                                  |
| visibility         | TEXT        | `public/unlisted/registered_users/project_members/private` (CHECK)   |
| publication_status | TEXT        | `draft/published/hidden/removed` (CHECK)                             |
| published_at       | TIMESTAMPTZ | Obligatorio si `publication_status='published'` (CHECK)              |
| created_at / updated_at | TIMESTAMPTZ |                                          |

CHECKs adicionales: `posts_video_type_check` (tipo `video` ⇒ `video_id` no
nulo; resto ⇒ `video_id` nulo), `posts_body_video_check` (tipo `video` ⇒
`body` nulo), `posts_body_length`, `posts_published_at_check`.

Índices (orientados al feed futuro): `posts_published_at_idx (published_at
desc)`, `posts_author_id_idx`, `posts_project_id_idx`,
`posts_organization_id_idx`, `posts_visibility_idx`,
`posts_publication_status_idx`, `posts_post_type_idx`,
`posts_listing_idx (publication_status, visibility, published_at desc)`.

Triggers:

- `posts_set_updated_at` / `posts_prevent_id_change` (helpers comunes).
- `posts_validate_video_ownership` (BEFORE INSERT/UPDATE): el autor del post
  debe ser el propietario del vídeo y `project_id`/`organization_id` deben
  coincidir exactamente con los del vídeo.
- `posts_prevent_video_change` (BEFORE UPDATE): `video_id` y `author_id` son
  inmutables; el ciclo de vida se gestiona a través del vídeo.
- `posts_sync_from_video` (AFTER INSERT/UPDATE/DELETE en `videos`): al publicar
  un vídeo garantiza EXACTAMENTE un post asociado mediante
  `INSERT ... ON CONFLICT (video_id) DO UPDATE` (idempotente: repetir la
  publicación no duplica). Cuando el vídeo deja de estar publicado
  (hidden/archived/removed) el post deja de distribuirse y limpia
  `published_at`.

Funciones:

- `post_is_publicly_distributable(text, text, uuid)` (función normal `STABLE`,
  invoker, `search_path=''`): predicado canónico de distributividad. Para posts
  de vídeo se deriva del vídeo (status `published` + processing `ready` +
  `video_is_publicly_distributable(moderation_status)` + coherencia de
  visibilidad); fail-closed ante divergencias. Los tipos futuros sin vídeo
  dependen solo de `publication_status`.

No hay política DELETE ni GRANT delete sobre `posts`: el ciclo de vida se
gestiona por el contenido asociado (los posts de vídeo se eliminan en cascada al
borrar el vídeo o el perfil). Esto preserva la invariante "un vídeo publicado ⇒
exactamente un post".

### RLS de posts

Ver [`RLS_POLICIES.md`](./RLS_POLICIES.md). Resumen: el público lee SOLO posts
distribuibles con visibilidad estrictamente `public` (unlisted no es enumerable
por un SELECT público genérico de `posts`: el acceso por enlace/ID se reserva
para el futuro); `registered_users` requiere autenticación; `project_members`
requiere ser miembro del proyecto; `private` solo el autor; el admin lee todo.
El usuario solo crea posts como sí mismo y solo puede enlazar vídeos propios;
el contenido moderado (rejected/flagged) nunca vuelve a ser visible a través de
un post porque la distributividad se deriva del vídeo.

### Backfill

La migración crea el post de cada vídeo `published` existente
(`insert ... select ... on conflict (video_id) do update`): no borra ni recrea
vídeos y es idempotente.

## FASE 4.2 — Seguimiento (`follows`)

Migración: `supabase/migrations/20260810000000_fase4_follows.sql`.

- **Tablas**: `profile_follows`, `project_follows`, `organization_follows`
  (idempotentes vía `ON CONFLICT DO NOTHING` y `UNIQUE` compuestas:
  `(follower_id, followed_id)`, `(follower_id, project_id)`,
  `(follower_id, organization_id)`).
- **Triggers** (invoker, no `SECURITY DEFINER`):
  - `project_follows_check` / `organization_follows_check`:
    `follower_id = auth.uid()`, no auto-seguirse, y quien sigue debe existir.
  - `profile_follows_check`: además, comprueba el bloqueo simétrico
    (`follows_blocked`).
  - `profile_blocks_cleanup_follows`: al bloquear/desbloquear un perfil,
    elimina `(A,B)` y `(B,A)` en `profile_follows`.
- **RPCs**: `follow_profile`, `follow_project`, `follow_organization`,
  `unfollow_profile`, `unfollow_project`, `unfollow_organization` (INSERT/DELETE
  únicos, invoker, dependen de las políticas `insert_own`/`delete_own`) y
  `get_profile_follow_counts` / `get_project_follow_counts` /
  `get_organization_follow_counts` (`SECURITY DEFINER`, solo conteos).
- **RLS**: `insert_own`/`delete_own` (ver `RLS_POLICIES.md`). Sin SELECT
  directo; los conteos públicos pasan por las RPCs. Grants solo a
  `authenticated`.
- **Capa de datos**: `src/follows/data.ts` expone las funciones tipadas
  (`follow*`, `unfollow*`, `isFollowing*`, `getFollowed*Ids`, `get*FollowCounts`)
  usadas por las páginas públicas de perfil, proyecto y organización.

## FASE 4.3 — Analytics de vídeo

Migración: `20260812000000_fase4_3_analytics.sql` (+ mínimo privilegio
`20260813000000_fase4_3_min_priv_analytics.sql`).

### `video_view_sessions`

Una fila agregada por (identidad, vídeo): el estado que permite acumular watch
time y cualificar vistas con idempotencia. La identidad es **disjunta**:
`viewer_id XOR anonymous_session_id` (solo uno puede ser no nulo).

| Columna              | Tipo        | Descripción                                                     |
| -------------------- | ----------- | --------------------------------------------------------------- |
| id                   | UUID (PK)   |                                                                 |
| video_id             | UUID (FK)   | `videos.id` (cascade)                                           |
| viewer_id            | UUID (FK)   | `profiles.id` (set null); NULL si es sesión anónima             |
| anonymous_session_id | TEXT        | Token anónimo (128 bits); NULL si es usuario autenticado        |
| plays                | INTEGER     | Conteos de reproducción (solo con ≥ 120 s)                      |
| qualified_views      | INTEGER     | Vista cualificada idempotente (≥ 3 s reales, o vídeo corto con progress ≥ 0.5) |
| completed            | INTEGER     | Completados (progress ≥ 0.95 y watch suficiente)                |
| watch_seconds        | DOUBLE      | Tiempo de pared REAL acumulado (delta por petición acotado)     |
| last_report_at       | TIMESTAMPTZ |                                                                 |
| created_at / updated_at | TIMESTAMPTZ |                                              |

Índices parciales de unicidad (`(video_id, viewer_id)` y
`(video_id, anonymous_session_id)`), de agregación y de búsqueda. **Sin GRANT
ni políticas SELECT**: nadie lee la tabla directamente; las métricas solo salen
por RPC.

- **Única vía de escritura**: `report_video_view(p_video_id, p_anonymous_session_id,
  p_watch_delta, p_progress)` (`SECURITY DEFINER`, fail-closed). Anti-inflado en
  **tiempo de pared real**: la primera petición de una sesión solo crea la fila
  con `watch_seconds = 0`; el delta se acota a 60 s/petición, a `elapsed + 2,5 s`
  y a `session_age − ya contado`. Una llamada inmediata suma 0; una qualified
  view exige ~3 s reales. `plays` solo con ≥ 120 s; `completed` con
  `progress ≥ 0.95` y `watch ≥ min(5, 50 % duración)`. Matriz de moderación:
  solo `unreviewed`/`approved` aceptan watch time; `rejected`/`flagged` fallan
  en caliente sin crear filas. El propietario nunca se auto-contabiliza.
- **RPCs de lectura** (`SECURITY DEFINER`): `get_video_metrics(p_video_id)`,
  `get_post_metrics(p_post_id)` (solo owner/admin, sin identidades),
  `get_public_video_views_count(p_video_id)` (contador público fail-closed) e
  interna `_video_metrics_aggregate` (sin EXECUTE público).
- **Grants**: tabla sin GRANT; RPCs concedidas según rol (anon solo las
  públicas; `_video_metrics_aggregate` a nadie).

### Espejo cliente

`src/analytics/` replica los umbrales (`config.ts`), valida con zod
(`schemas.ts`), acumula segundos reales ignorando seeks (`player-tracker.ts`),
envía por delta/flush (`reporter.ts`, fail-closed) y conecta el player con
Supabase + sesión anónima (token 128 bits, TTL 30 días) vía `use-video-analytics.ts`.

## FASE 4.4 — Feed (RPCs "Para ti" y "Siguiendo")

Migración: `supabase/migrations/20260814000000_fase4_4_feed.sql`. **No crea
tablas ni índices**: define dos funciones SQL puras que reutilizan los índices
existentes.

- `get_for_you_feed(p_limit integer default 12, p_cursor_score numeric default
  null, p_cursor_published_at timestamptz default null, p_cursor_id uuid default
  null)`: ranking "Para ti" determinista, anon+authenticated.
- `get_following_feed(p_limit integer default 12, p_cursor_published_at
  timestamptz default null, p_cursor_id uuid default null)`: cronológico, solo
  authenticated.
- Ambas son `SECURITY DEFINER`, devuelven el payload completo en una llamada
  (post + vídeo + autor + proyecto + organización + métricas agregadas) y
  excluyen contenido no distribuible, `unlisted`, moderación
  `rejected`/`flagged` y autores que bloquean al lector (y al revés). El cursor
  usa `(score, published_at, id)` en "Para ti" y `(published_at, id)` en
  "Siguiendo" (sin OFFSET). Fórmula de score espejada en `src/feed/config.ts`
  y `ranking.ts` (pesos suman 1.0; half-life recency 168 h; caps/smoothing).
- La diversidad (`src/feed/diversity.ts`) reordena DENTRO de cada página sin
  eliminar candidatos y sin alterar el cursor (que se deriva del último item del
  orden SQL del lote).
- ACL: `get_for_you_feed` → anon+authenticated; `get_following_feed` →
  authenticated. Se concedió `EXECUTE` de `post_is_publicly_distributable` y
  `video_is_publicly_distributable` a anon+authenticated: las políticas RLS
  `videos_select_public/registered/project_members` y
  `posts_select_public/registered/project_members` (y las de storage) invocan
  esos predicados con los privilegios del llamador, por lo que deben ser
  ejecutables por quien lee.

## Esquema futuro (no implementado)

Tablas previstas para fases posteriores: `ideas`, `feedback`, `communities`,
`community_members`. Los tipos de post `text`, `project_update`, `opportunity`
y `article` están preparados en `posts.post_type` pero aún no se crean.

## Seguridad

- Row Level Security activado en todas las tablas, definido en las propias migraciones.
- Políticas por rol y propiedad del recurso (mínimo privilegio).
- Las claves de servicio solo se usan en Server Actions; nunca se exponen al cliente.
- El esquema tipado se regenera desde el remoto (`supabase:types`); todas las
  migraciones hasta FASE 4.4 (`20260814000000`) están aplicadas en remoto, por
  lo que `src/types/database.types.ts` refleja el esquema real. Nota: el
  generador marca `returns table` como non-null; las columnas de LEFT JOIN
  devuelven `null` en runtime, y `src/feed/data.ts` hace el cast honesto en la
  frontera de las RPC del feed.
