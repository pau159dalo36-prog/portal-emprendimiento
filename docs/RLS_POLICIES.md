# Row Level Security — FASE 4 (vídeos, moderación post-publicación)

RLS está activado en `public.videos` y `public.video_languages`. El proyecto
tiene `auto_expose_new_tables` desactivado, por lo que además de las políticas
se conceden `GRANT` explícitos.

## `videos`

| Política                        | Operación | Condición                                                                 |
| ------------------------------- | --------- | ------------------------------------------------------------------------- |
| `videos_select_public`          | SELECT    | `status='published'` y `processing_status='ready'` y `public.video_is_publicly_distributable(moderation_status)` y `visibility in ('public','unlisted')` |
| `videos_select_own`             | SELECT    | `auth.uid() = owner_id` (incluye borradores y contenido propio)           |
| `videos_select_registered`      | SELECT    | `auth.role()='authenticated'`, publicado, listo, distributable y `visibility='registered_users'` |
| `videos_select_project_members` | SELECT    | Publicado, listo, distributable, `visibility='project_members'`, `project_id` no nulo y `public.is_project_member(project_id)` |
| `videos_insert_own`             | INSERT    | `auth.uid() = owner_id`, proyecto/organización de los que es miembro      |
| `videos_update_own`             | UPDATE    | USING + WITH CHECK: `auth.uid() = owner_id`, proyecto/organización de los que es miembro |
| `videos_delete_own`             | DELETE    | `auth.uid() = owner_id`                                                   |

Notas:

- La condición de visibilidad se combina con el **estado de publicación** y con
  `public.video_is_publicly_distributable(moderation_status)` (predicado canónico
  que devuelve `true` salvo para `rejected`/`flagged`). Un vídeo publicado sin
  revisar (`unreviewed`) o aprobado se sirve; `rejected`/`flagged` dejan de
  listarse y de servirse de inmediato, sin cambiar `status` ni `published_at`.
- La moderación es **solo administrativa y post-publicación**: el propietario
  publica libremente (`status='published'` + `processing_status='ready'`); el
  estado de moderación no bloquea la publicación. El usuario no puede alterar
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

## Predicado de distribución

`public.video_is_publicly_distributable(text)` (función normal `STABLE`,
`search_path=''`) devuelve `true` salvo para `rejected`/`flagged`. Es la ÚNICA
fuente de verdad usada por las políticas de `videos`, las políticas de storage y
`can_access_video_storage`, de modo que "un vídeo publicado se sirve sin revisión
previa" y "rechazado/marcado queda bloqueado" no pueden divergir entre capas.

## Miniaturas (`thumbnail_bucket` / `poster_bucket`)

El trigger `videos_validate_thumbnail_visibility` obliga a que la miniatura/
póster de la clase pública (`public`/`unlisted`) viva en `video-thumbnails` y la
de la clase protegida en `private-videos` (o no existir). La política de SELECT
de `video-thumbnails` exige que el objeto esté referenciado por un vídeo
publicado, listo y distributable de clase pública (o pertenecer al propio
usuario), por lo que un vídeo rechazado, marcado o protegido nunca filtra su
portada.

## Helper `SECURITY DEFINER`

`public.can_access_video_storage(p_bucket text, p_path text)` determina si el
usuario actual puede leer un objeto de `private-videos` (owner, o vídeo
publicado listo distributable con visibilidad `registered_users`/`project_members`),
y también las miniaturas/portadas privadas que conviven en `private-videos`. Se
usa en la política de SELECT de `storage.objects` para evitar consultar `videos`
directamente desde la política (recursión RLS). Igual que el resto de helpers
(`is_organization_member`, `is_project_member`), usa `security definer` y
`set search_path = ''`.
