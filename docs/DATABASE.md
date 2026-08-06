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
| moderation_status  | TEXT        | `pending/approved/rejected/flagged` (CHECK)                     |
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
privilegios) usada por los triggers de validación.

### `video_languages`

Catálogo de idiomas de origen (`es`, `en`), solo lectura pública (RLS
`video_languages_select_all`).

### RLS de vídeos

Ver [`RLS_POLICIES.md`](./RLS_POLICIES.md). Las lecturas públicas requieren
`status='published'`, `processing_status='ready'` y
`moderation_status='approved'`; el propietario siempre ve sus filas.

### Storage — buckets de vídeo

| Bucket             | Público | Límite | MIME                          |
| ------------------ | ------- | ------ | ----------------------------- |
| `public-videos`    | Sí      | 100 MB | `video/mp4`, `video/webm`     |
| `private-videos`   | No      | 100 MB | `video/mp4`, `video/webm`     |
| `video-thumbnails` | Sí      | 5 MB   | `image/png`, `image/jpeg`, `image/webp` |

Políticas de aislamiento por carpeta `<auth.uid()>/…` y signed URLs para el
bucket privado. `video-thumbnails` solo sirve por URL pública objetos
referenciados por un vídeo publicado/listo/aprobado de clase pública (o del
propio usuario). Detalle en [`STORAGE_POLICIES.md`](./STORAGE_POLICIES.md).

## Esquema futuro (no implementado)

Tablas previstas para fases posteriores: `ideas`, `feedback`, `communities`, `community_members`.

## Seguridad

- Row Level Security activado en todas las tablas, definido en las propias migraciones.
- Políticas por rol y propiedad del recurso (mínimo privilegio).
- Las claves de servicio solo se usan en Server Actions; nunca se exponen al cliente.
- El esquema tipado se regenera desde el remoto (`supabase:types`); mientras la
  migración FASE 3 no se aplique en remoto, `src/types/database.types.ts` se ha
  sincronizado a mano con la migración.
