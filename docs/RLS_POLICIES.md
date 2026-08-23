# Row Level Security — FASE 4/5/9 (vídeos, moderación post-publicación, posts, seguimiento, analytics, feed, búsqueda, interacciones)

RLS está activado en `public.videos`, `public.video_languages`,
`public.posts`, `public.profile_follows`, `public.project_follows`,
`public.organization_follows`, `public.video_view_sessions`,
`public.post_comments`, `public.project_feedback`, `public.post_reactions`,
`public.saved_posts`, `public.saved_projects`, `public.saved_opportunities` y
`public.interaction_events`. El proyecto tiene
`auto_expose_new_tables` desactivado, por lo que además de las políticas se
conceden `GRANT` explícitos.

## `posts`

| Política                    | Operación | Condición                                                                  |
| --------------------------- | --------- | -------------------------------------------------------------------------- |
| `posts_select_public`       | SELECT    | `post_is_publicly_distributable(...)` y `visibility = 'public'` |
| `posts_select_own`          | SELECT    | `auth.uid() = author_id` (incluye borradores y contenido retirado)         |
| `posts_select_registered`   | SELECT    | `authenticated`, distribuible y `visibility='registered_users'`            |
| `posts_select_project_members` | SELECT | `authenticated`, distribuible, `visibility='project_members'`, `project_id` no nulo y `public.is_project_member(project_id)` |
| `posts_select_admin`        | SELECT    | `authenticated` y `public.is_platform_admin()` (lectura total)             |
| `posts_insert_own`          | INSERT    | `auth.uid() = author_id`, vídeo propio (o nulo), proyecto/organización de los que es miembro |
| `posts_update_own`          | UPDATE    | USING + WITH CHECK: `auth.uid() = author_id`, proyecto/organización de los que es miembro |
| (DELETE)                    | —         | No hay política DELETE ni GRANT delete: el ciclo de vida se gestiona por el contenido |

Notas:

- La distributividad de un post de vídeo se **deriva por completo del vídeo**
  mediante `post_is_publicly_distributable(publication_status, visibility,
  video_id)` (predicado canónico, función normal `STABLE` invoker con
  `search_path=''`): exige `publication_status='published'` y, si hay vídeo,
  que el vídeo esté `published` + `ready` + `video_is_publicly_distributable`
  (no `rejected`/`flagged`) + visibilidad coherente. Fail-closed: cualquier
  divergencia deja de distribuir. El predicado no valora el nivel de visibilidad:
  ese tier lo gobierna cada política (anon solo `visibility='public'`).
- `unlisted` NO es enumerable mediante un SELECT público genérico de `posts`: la
  RLS exige `visibility='public'` para anónimos, por lo que no aparece ni en el
  feed ni en ningún listado. El acceso por enlace/ID se reserva para el futuro
  (mecanismo específico, sin SECURITY DEFINER nuevo en FASE 4.1).
  `registered_users`, `project_members` y `private` nunca se distribuyen
  públicamente.
- El usuario solo crea posts como sí mismo (`auth.uid() = author_id`) y solo
  puede enlazar vídeos propios; los triggers refuerzan la misma invariante
  (propietario + proyecto/organización coherentes con el vídeo).
- La moderación post-publicación se propaga automáticamente: rechazar o marcar
  el vídeo retira su post de la distribución al instante; aprobar lo restaura,
  sin borrar ni re-crear el post.
- `posts_select_admin` está restringida a `authenticated` (mismo patrón que
  `videos_select_admin`).

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

grant select on public.posts to anon, authenticated;
grant select, insert, update on public.posts to authenticated;
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

## FASE 4.2 — Seguimiento (`profile_follows`, `project_follows`, `organization_follows`)

| Tabla                  | Política         | Operación | Condición                                                        |
| ---------------------- | ---------------- | --------- | ---------------------------------------------------------------- |
| `profile_follows`      | `insert_own`     | INSERT    | `auth.uid() = follower_id`                                       |
| `profile_follows`      | `delete_own`     | DELETE    | `auth.uid() = follower_id`                                       |
| `project_follows`      | `insert_own`     | INSERT    | `auth.uid() = follower_id`                                       |
| `project_follows`      | `delete_own`     | DELETE    | `auth.uid() = follower_id`                                       |
| `organization_follows` | `insert_own`     | INSERT    | `auth.uid() = follower_id`                                       |
| `organization_follows` | `delete_own`     | DELETE    | `auth.uid() = follower_id`                                       |

Notas:

- **Sin SELECT**: nadie puede enumerar seguidores/seguidos directamente sobre
  estas tablas (ni siquiera el propio usuario). Los conteos públicos se exponen
  solo mediante las RPCs `get_profile_follow_counts` /
  `get_project_follow_counts` / `get_organization_follow_counts`
  (`SECURITY DEFINER`, invoker-only vía `grant execute` a `authenticated`), que
  solo devuelven el número de seguidores y seguidos, no identidades.
- **Los triggers no son `SECURITY DEFINER`** (invoker): exigen que el usuario
  tenga el rol `authenticated` en el JWT actual (`get_claim('app_metadata.role')
  = 'authenticated'`) y aplican el saneamiento simétrico de bloqueos. Un
  trigger invoker depende de la política de INSERT (por eso `insert_own` existe);
  los seguidos/seguidores y la restricción `follows_blocked` se comprueban solo
  si `auth.uid() IS NOT NULL`, de modo que el alta de datos vía SQL/scripts no
  queda bloqueada.
- **Cada usuario sigue solo como sí mismo**: los CHECK `follows_actor_is_follower`
  (`follower_id = auth.uid()`) y `follows_not_self_follow` (`follower_id <>
  followed_id`) son inmutables por RLS; además `insert_own` fija el actor.
- **Saneamiento simétrico de bloqueos**: si A bloquea a B, el trigger
  `profile_blocks_cleanup_follows` elimina `(A,B)` y `(B,A)` en
  `profile_follows`; y `profile_follows_check` impide que un usuario seguido por
  quien le bloquea vuelva a seguirlo. La relación `(B,A)` queda bloqueada por
  ambas direcciones aunque la política no la permita escribir.
- **Unicidad**: `UNIQUE (follower_id, followed_id)` y `UNIQUE
  (follower_id, project_id)` / `(follower_id, organization_id)` garantizan que
  un seguidor no siga dos veces el mismo objetivo. `ON CONFLICT DO NOTHING` en
  las RPCs `follow_*` hace el follow idempotente.
- **Conteos**: las RPCs de conteo realizan un único `count(*)` filtrado
  (fail-closed: fila inexistente devuelve `0`) y se usan en las páginas públicas
  de perfil/proyecto/organización. No hay autoincrementos manuales que puedan
  desincronizarse.
- **Grants**: `select/insert/delete` sobre las tres tablas solo para el rol
  `authenticated`; nada para `anon`. Las RPCs de conteo y follow se conceden
  solo a `authenticated`.

## FASE 4.3 — Analytics (`video_view_sessions` y RPCs)

- **Tabla `video_view_sessions` SIN políticas y SIN GRANT**: nadie (ni siquiera
  el propietario del vídeo) puede leer la tabla directamente. Las métricas
  salen únicamente por las RPCs `get_video_metrics` / `get_post_metrics`
  (`SECURITY DEFINER`, solo owner/admin, agregadas, sin identidades) y
  `get_public_video_views_count` (contador público fail-closed).
- **Única escritura**: `report_video_view` (`SECURITY DEFINER`, fail-closed).
  Valida identidad disjunta (`viewer_id XOR anonymous_session_id`), matriz de
  moderación (`unreviewed`/`approved` aceptan watch time; `rejected`/`flagged`
  fallan sin crear filas) y anti-inflado por tiempo de pared real. El
  propietario no se auto-contabiliza.
- **Grants**: `EXECUTE` de `report_video_view`, `get_video_metrics`,
  `get_post_metrics` y `get_public_video_views_count` a anon/authenticated
  según rol; el helper interno `_video_metrics_aggregate` NO tiene EXECUTE
  público (solo se invoca desde dentro de las RPCs `SECURITY DEFINER`).

## FASE 4.4 — Feed (RPCs y ACL)

- **`get_for_you_feed`**: `EXECUTE` para `anon` y `authenticated`. Devuelve
  contenido públicamente distribuible + (si hay sesión) afinidad por follows y
  exclusión de autores que bloquean al lector (y al revés). Para anónimos la
  afinidad es 0 (nada personalizado se filtra).
- **`get_following_feed`**: `EXECUTE` SOLO para `authenticated` (fail-closed:
  anon recibe `permission denied`). Exige `auth.uid()` no nulo; nunca expone el
  feed personal de otro usuario (la identidad sale de `auth.uid()`, no de un
  parámetro).
- **Predicados de distribución**: se concedió `EXECUTE` de
  `post_is_publicly_distributable` y `video_is_publicly_distributable` a
  `anon` y `authenticated` (son funciones **invoker**): las políticas RLS
  `videos_select_public/registered/project_members`,
  `posts_select_public/registered/project_members` y las de storage invocan
  estos predicados con los privilegios del llamador y deben poder ejecutarlos.
  No suponen elevación de privilegios: son funciones normales `STABLE` que solo
  evalúan estados del contenido.
- **Sin nuevas políticas SELECT**: las RPC del feed hacen SELECT con
  `SECURITY DEFINER` y aplican ellas mismas los filtros de distribución,
  moderación, visibilidad y bloqueos; el resultado que llega al cliente ya está
  filtrado y paginado (nunca filas de `posts`/`videos` crudas).

## FASE 5 — Búsqueda (RPCs y ACL)

- **Cuatro RPCs `SECURITY DEFINER`** (`search_profiles`, `search_projects`,
  `search_organizations`, `search_videos`) con `EXECUTE` para `anon` y
  `authenticated` (REVOKE previo de `public`). Aplican ellas mismas los filtros:
  privacidad de perfiles, distributividad de contenido, moderación
  `rejected`/`flagged` y exclusión de autores que bloquean al lector (y al
  revés). `is_following` se calcula por fila con `auth.uid()` del llamante (nunca
  de un parámetro).
- **Helpers `search_normalize` / `search_recency`**: funciones normales invoker
  con `search_path=''`; se concede `EXECUTE` a `anon`/`authenticated` porque las
  columnas generadas y el plan de las RPC los invocan con los privilegios del
  llamador. No elevan privilegios: solo normalizan y calculan recencia
  (fail-closed ante NULL).
- **Identidad y alcance**: la búsqueda nunca recibe `p_user_id`; el alcance de
  cada lector se deriva de `auth.uid()`. El cursor es opaco para la UI y se
  deriva del último item del orden SQL del lote (paginación estable sin OFFSET).

## FASE 6 — Oportunidades (tabla `opportunities`)

- **7 políticas en `opportunities`** (RLS activado, sin política DELETE: el
  ciclo de vida `draft/published/closed/filled/cancelled` sustituye al borrado):
  - `opportunities_select_public` (TO PUBLIC): solo oportunidades
    distribuibles con `visibility = 'public'` (predicado
    `opportunity_is_publicly_distributable`).
  - `opportunities_select_own` (TO PUBLIC): el creador siempre ve las suyas
    (borradores, privadas, rechazadas...).
  - `opportunities_select_registered` (authenticated): distribuibles con
    `visibility = 'registered_users'`.
  - `opportunities_select_project_members` (authenticated): distribuibles con
    `visibility = 'project_members'` y `is_project_member(project_id)`.
  - `opportunities_select_admin` (authenticated): `is_platform_admin()`
    (moderación).
  - `opportunities_insert_own` (authenticated): WITH CHECK `auth.uid() =
    creator_id` y contexto real (`is_project_member`/`is_organization_member`
    cuando hay ancla).
  - `opportunities_update_manage` (authenticated): USING + WITH CHECK
    `auth.uid() = creator_id OR is_project_member(project_id) OR
    is_organization_member(organization_id) OR is_platform_admin()`.
- **ACL de funciones**: REVOKE de `public` + GRANT explícito.
  `search_opportunities` → anon+authenticated; predicado
  `opportunity_is_publicly_distributable` → anon+authenticated (lo invocan las
  políticas RLS de SELECT con los privilegios del llamador); RPC admin
  (`admin_approve/reject/flag_opportunity`) → solo authenticated con
  `is_platform_admin()` interno (fail-closed); funciones de trigger
  (`opportunities_validate_state_change`, `posts_sync_from_opportunity`) sin
  concesión útil. Nota: los grants residuales de anon/authenticated que muestran
  los default privileges de Supabase sobre funciones de trigger existen también
  en fases 3-4 y son no-op (las funciones no aceptan argumentos).
- **Granularidad del predicado**: `opportunity_is_publicly_distributable`
  excluye `draft`, estados terminales `closed/filled/cancelled`, moderación
  `rejected/flagged` y turnos de 1 día con `ends_at` pasado.

## FASE 9 — Interacciones (comentarios, feedback, reacciones, guardados, outbox)

- **`post_comments`** (anon solo lee): `comments_select_public` (TO PUBLIC:
  post distribuible con `visibility='public'`; el listado público excluye
  ocultos y eliminados), `comments_select_own/registered/project_members/admin`
  (mismo patrón de tiers que `posts`). Escritura solo authenticated:
  `comments_insert_own` (WITH CHECK: autor = `auth.uid()`, post público
  distribuible y sin bloqueo mutuo vía `profiles_can_interact`),
  `comments_update_own` (USING + WITH CHECK propio; trigger refuerza
  inmutabilidad de `post_id`/`author_id`/`parent_id`) y `comments_delete_own`.
  El ocultado es soft (`is_hidden`) y siempre limitado a lo propio.
- **`project_feedback`**: SELECT para autor, propietario/miembros del proyecto y
  admin; INSERT solo si el proyecto es públicamente visible y NO es suyo
  (self-feedback denegado) sin bloqueo mutuo; UPDATE solo el autor (upsert de
  feedback). Sin DELETE ni grants de borrado.
- **`post_reactions`**: SELECT solo del propio registro (los conteos públicos
  salen de la RPC agregada `get_post_interaction_counts`, que nunca expone
  identidades); INSERT/DELETE propios sobre posts públicos distribuibles sin
  bloqueo. El toggle idempotente vive en la RPC SECURITY DEFINER
  `toggle_post_support` (fail-closed: `POST_NOT_INTERACTABLE`).
- **Guardados** (`saved_posts` / `saved_projects` / `saved_opportunities`):
  políticas estrictas `*_all_own` — USING + WITH CHECK
  `auth.uid() = profile_id` en todas las operaciones; nadie enumera guardados
  ajenos. INSERT exige además que el contenido sea públicamente distribuible.
- **Outbox `interaction_events`**: RLS activado SIN políticas (deniega todo a
  anon/authenticated) y ACL revocada: solo service_role lee/escribe y los
  triggers SECURITY DEFINER insertan. Preparado para FASE 10.
- **Helpers/RPCs**: `profiles_can_interact(uuid, uuid)` y
  `project_is_publicly_visible(uuid)` son funciones invoker concedidas a
  authenticated (las usan las políticas WITH CHECK con privilegios del
  llamador); `toggle_post_support`, `get_post_interaction_counts`,
  `get_project_feedback_count` son SECURITY DEFINER con REVOKE de `public` +
  GRANT explícito (conteos también a anon porque alimentan la página pública;
  fail-closed y sin fugas de contenido no público). Las funciones internas de
  triggers no tienen EXECUTE útil. Corrección de mínimo privilegio idempotente
  en `20260820000000_fase9_min_priv_interacciones.sql`.
