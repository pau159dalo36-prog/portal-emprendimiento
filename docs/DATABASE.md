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

## Esquema futuro (no implementado)

Tablas previstas para fases posteriores: `ideas`, `feedback`, `communities`, `community_members`.

## Seguridad

- Row Level Security activado en todas las tablas, definido en las propias migraciones.
- Políticas por rol y propiedad del recurso (mínimo privilegio).
- Las claves de servicio solo se usan en Server Actions; nunca se exponen al cliente.
- El esquema tipado se regenera desde el remoto (`supabase:types`); nunca se edita a mano el archivo `src/types/database.types.ts`.
