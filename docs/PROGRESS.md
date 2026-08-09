# Estado del proyecto — FASE 4.2 (Seguimiento social)

## Estado general

- ✅ **FASE 4.2 aplicada en remoto** (`20260810000000_fase4_follows.sql` +
  corrección `20260811000000_fase4_2_min_priv_follows.sql`), tipos regenerados
  y verificaciones read-only correctas.
- ✅ **FASE 4.1 aplicada** (migración `20260809000000` en remoto).
- ✅ **FASE 3 completada** (subida, imágenes, publicación, moderación,
  reproductor, portada, panel, tests y docs).

## FASE 4.2 — Seguimiento (`follows`)

Deliverables creados y revisados:

- `supabase/migrations/20260810000000_fase4_follows.sql`: tablas
  `project_follows` y `organization_follows` (reutiliza `profile_follows` de
  FASE 1), triggers invoker (`project_follows_check`,
  `organization_follows_check`, `profile_follows_check`,
  `profile_blocks_cleanup_follows`), RPCs de conteo `count_*_followers/following`
  (`SECURITY DEFINER`, SOLO totales bigint), RLS `insert_own`/`delete_own` y
  políticas `select_own`/`select_team`, más `profile_blocks_select_blocked` y
  `profile_follows_delete_blocked` para el saneamiento simétrico de bloqueos.
- `supabase/migrations/20260811000000_fase4_2_min_priv_follows.sql`:
  corrección de mínimo privilegio. `REVOKE SELECT ... FROM anon` sobre
  `profile_follows`, `project_follows` y `organization_follows` (heredado del
  auto-expose) + `GRANT SELECT ... TO authenticated` idempotente. Las RPC de
  conteo siguen ejecutables por `anon` (EXECUTE) y devuelven solo números.
- `supabase/tests/fase4_follows.sql`: script de verificación SQL (transacción
  que se revierte) que valida RLS con `set role`/`request.jwt.claims`, triggers,
  bloqueos simétricos (TEST 8 y 8B), unicidad, conteos, grants y el revoke de
  lectura a `anon` (TEST 1).
- `src/follows/`: capa de acceso a datos (`data.ts` con `follow*`, `unfollow*`,
  `isFollowing*`, `getFollowed*Ids`, `get*FollowCounts`).
- `src/actions/follows.ts`: Server Action `toggleFollowAction` (requiere sesión
  y usa `user.id` como actor); `src/validations/follows.ts`: validación UUID.
- `src/follows/data.test.ts`: 14 tests unitarios de la capa de datos.
- `src/app/[locale]/perfil/[username]/page.tsx`,
  `src/app/[locale]/proyectos/[slug]/page.tsx`,
  `src/app/[locale]/organizaciones/[slug]/page.tsx`: importan la capa de datos
  de `src/follows` para los contadores y el `FollowButton`.
- `src/types/database.types.ts`: regenerado con `npm run supabase:types` desde
  el remoto (incluye tablas y RPCs de follows).
- Docs actualizadas: `DATABASE.md`, `RLS_POLICIES.md`, `SECURITY.md`,
  `ARCHITECTURE.md` (carpeta `src/follows`).

### Verificación actual

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (147 tests, 14 de `src/follows/data.test.ts`)
- `npm run build` ✅
- Migraciones `20260810000000` y `20260811000000` **aplicadas en remoto**;
  `migration list` local=remoto (11/11).
- Comprobaciones read-only contra remoto ✅: tras la corrección, anon recibe
  `permission denied` al SELECT directo de las 3 tablas de follows; las RPC de
  conteo siguen ejecutándose para anon y devuelven solo `bigint` (0).
- Test SQL `supabase/tests/fase4_follows.sql` **sin ejecutar** (requiere stack
  local/Docker; NO debe ejecutarse contra producción). Incluye TEST 1 (anon no
  lee/inserta/borra), TEST 8B (bloqueo simétrico en ambas direcciones) y la
  cobertura de authenticated (TEST 3, 7, 9, 10, 12).

### Pendiente / decisiones

- Ejecutar `supabase/tests/fase4_follows.sql` contra el stack local cuando
  Docker esté disponible (verificación completa de los caminos autenticados de
  follows/bloqueos).
- La FASE 4.3 (interacciones) aún no empieza.

## FASE 4.1 — Entidad `posts` (capa base distribuible)

Deliverables creados y revisados:

- `supabase/migrations/20260809000000_fase4_posts.sql`: tabla `posts`
  (envelope genérico con `UNIQUE(video_id)`), índices orientados al feed,
  predicado `post_is_publicly_distributable`, triggers de sincronización
  idempotente `posts_sync_from_video` + validación de propiedad
  (`posts_validate_video_ownership`), RLS completa y backfill idempotente de
  los vídeos publicados existentes. Sin SECURITY DEFINER nuevo.
- `supabase/tests/fase4_posts.sql`: script de verificación SQL (transacción
  que se revierte) con 13 bloques de tests: invariante 1 post/vídeo,
  idempotencia, ciclo de vida, matriz de visibilidad anónima, registered,
  project_members, private, admin, restricciones de creación, inmutabilidad,
  sin DELETE, moderación rejected/flagged propagada al post y predicado
  fail-closed.
- `src/posts/`: capa de acceso a datos (`data.ts`, `types.ts`, `schemas.ts`,
  `constants.ts`) + `src/config/post.ts`. Server Components por defecto.
- `src/posts/data.test.ts`: tests unitarios de la capa de datos y constantes.
- `src/types/database.types.ts`: sincronizado a mano con `posts` y
  `post_is_publicly_distributable` (hasta regenerar con `supabase:types` tras
  aplicar la migración en remoto).
- Docs actualizadas: `DATABASE.md`, `RLS_POLICIES.md`, `SECURITY.md`,
  `ARCHITECTURE.md` (carpeta `src/posts`).

### Verificación actual

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (se añadió `src/posts/data.test.ts`)
- `npm run build` ✅

### Pendiente / decisiones

- **La migración NO se ha aplicado** (ni `db push` ni `db reset`): pendiente de
  revisión y aprobación de la arquitectura.
- Tras aprobar: `npm run supabase:db:push` → `npm run supabase:types` →
  ejecutar `supabase/tests/fase4_posts.sql` contra el stack local.
- FASE 4.2 (feed/algoritmo), 4.3 (interacciones) y 4.4 (seguir) NO empiezan.

## FASE 3 — Estado previo (para referencia)

- ✅ **PASOS 1–18 completados y verificados** (subida, imágenes, publicación,
  moderación, reproductor, portada, panel, i18n, tests, docs).
- Verificación: `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run test` ✅
  (109 antes de 4.1) · `npm run build` ✅ (30 rutas).
- Pendiente / decisiones:
  - El propietario no puede "reenviar a moderación"; los rechazados solo se
    pueden editar/eliminar. La publicación no exige aprobación (moderación
    post-publicación) y las server actions cierran la invariante.
  - Lógica de secciones/acciones del panel en `src/videos/panel.ts`.
  - Los captions se limpian con el bucket del vídeo.

## Remoto

- Proyecto enlazado: `efgmjuzcqolpibraymol` (no tocar `raqcchcvypeptywpjisn`).
- Sin commit/push pendiente de autorización.
