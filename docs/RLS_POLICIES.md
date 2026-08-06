# Row Level Security — FASE 3 (vídeos)

RLS está activado en `public.videos` y `public.video_languages`. El proyecto
tiene `auto_expose_new_tables` desactivado, por lo que además de las políticas
se conceden `GRANT` explícitos.

## `videos`

| Política                        | Operación | Condición                                                                 |
| ------------------------------- | --------- | ------------------------------------------------------------------------- |
| `videos_select_public`          | SELECT    | `status='published'` y `processing_status='ready'` y `moderation_status='approved'` y `visibility in ('public','unlisted')` |
| `videos_select_own`             | SELECT    | `auth.uid() = owner_id` (incluye borradores y contenido propio)           |
| `videos_select_registered`      | SELECT    | `auth.role()='authenticated'`, publicado, listo, aprobado y `visibility='registered_users'` |
| `videos_select_project_members` | SELECT    | Publicado, listo, aprobado, `visibility='project_members'`, `project_id` no nulo y `public.is_project_member(project_id)` |
| `videos_insert_own`             | INSERT    | `auth.uid() = owner_id`, proyecto/organización de los que es miembro      |
| `videos_update_own`             | UPDATE    | USING + WITH CHECK: `auth.uid() = owner_id`, proyecto/organización de los que es miembro |
| `videos_delete_own`             | DELETE    | `auth.uid() = owner_id`                                                   |

Notas:

- La condición de visibilidad se combina con el **estado de publicación y de
  moderación**: `public`/`unlisted`/`registered_users`/`project_members` solo
  son visibles cuando `status='published'`, `processing_status='ready'` y
  `moderation_status='approved'`. El propietario siempre ve sus filas, incluyendo
  borradores y pendientes. Un vídeo pendiente/rechazado/marcado nunca se lista
  públicamente.
- La moderación es **solo administrativa**: el usuario no puede alterar
  `moderation_status` ni sus campos de auditoría. El trigger
  `videos_validate_state_change` lo bloquea salvo que el autor de la sentencia
  sea un administrador distinto del propietario (verificado con `auth.jwt()` a
  través de `is_platform_admin()`); no existe ningún guard de transacción que el
  cliente pueda fijar.
- `videos_select_project_members` usa `public.is_project_member()` (SECURITY
  DEFINER, definida en FASE 2) para evitar recursión de RLS.
- El borrado de un vídeo queda restringido al propietario; los objetos de
  Storage se limpian desde `deleteVideoAction`.

## `video_languages`

| Política                     | Operación | Condición |
| ---------------------------- | --------- | --------- |
| `video_languages_select_all` | SELECT    | `true`    |

Catálogo de solo lectura para cualquier rol.

## Grants

```sql
grant usage on schema public to anon, authenticated;
grant select on public.video_languages, public.videos to anon, authenticated;
grant select, insert, update, delete on public.videos to authenticated;
```

## Moderación administrativa

`public.is_platform_admin()` comprueba **exclusivamente**
`auth.jwt()->'app_metadata'->>'role' = 'admin'` y es una función **normal**
(`STABLE`, invoker, `search_path=''`): no eleva privilegios. Las RPCs
`admin_approve_video(uuid)`, `admin_reject_video(uuid, text)` y
`admin_flag_video(uuid, text)` son `SECURITY DEFINER` con `search_path=''`,
verifican el rol internamente, rechazan moderar vídeos propios y registran
auditoría (`moderated_by`, `moderated_at`, `moderation_reason`). Solo
`authenticated` puede ejecutarlas; `public`/`anon` tienen EXECUTE revocado.

## Miniaturas (`thumbnail_bucket` / `poster_bucket`)

El trigger `videos_validate_thumbnail_visibility` obliga a que la miniatura/
póster de la clase pública (`public`/`unlisted`) viva en `video-thumbnails` y la
de la clase protegida en `private-videos` (o no existir). La política de SELECT
de `video-thumbnails` exige que el objeto esté referenciado por un vídeo
publicado, listo y aprobado de clase pública (o pertenecer al propio usuario),
por lo que un vídeo pendiente o protegido nunca filtra su portada.

## Helper `SECURITY DEFINER`

`public.can_access_video_storage(p_bucket text, p_path text)` determina si el
usuario actual puede leer un objeto de `private-videos` (owner, o vídeo
publicado listo aprobado con visibilidad `registered_users`/`project_members`),
y también las miniaturas/portadas privadas que conviven en `private-videos`. Se
usa en la política de SELECT de `storage.objects` para evitar consultar `videos`
directamente desde la política (recursión RLS). Igual que el resto de helpers
(`is_organization_member`, `is_project_member`), usa `security definer` y
`set search_path = ''`.
