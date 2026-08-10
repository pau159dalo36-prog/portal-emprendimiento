# Estado del proyecto — FASE 4.3 (Analytics de vídeo)

## Estado general

- ✅ **FASE 4.3 aplicada en remoto**: migración `20260812000000_fase4_3_analytics.sql`
  + corrección de mínimo privilegio `20260813000000_fase4_3_min_priv_analytics.sql`
  aplicadas (migration list local=remoto 13/13), tipos regenerados con
  `npm run supabase:types` (sin diff: ya estaban en sincronía) y verificación
  completa `npm run check` en verde. Se corrigió un test de `src/analytics/data.test.ts`
  que esperaba `p_anonymous_session_id: null` cuando la capa de datos envía
  `undefined` (alineado con los tipos generados; la RPC usa default null).
- ✅ **FASE 4.2 aplicada en remoto** (`20260810000000_fase4_follows.sql` +
  corrección `20260811000000_fase4_2_min_priv_follows.sql`), tipos regenerados
  y verificaciones read-only correctas.
- ✅ **FASE 4.1 aplicada** (migración `20260809000000` en remoto).
- ✅ **FASE 3 completada** (subida, imágenes, publicación, moderación,
  reproductor, portada, panel, tests y docs).

## FASE 4.3 — Analytics de vídeo (vistas, watch time y métricas)

Deliverables creados y revisados:

- `supabase/migrations/20260812000000_fase4_3_analytics.sql`: tabla
  `video_view_sessions` (una fila agregada por (identidad, vídeo), identidad
  disjunta viewer_id XOR token anónimo, checks de formato/rango), índices
  parciales de unicidad y de consulta, helper `video_analytics_access`
  (owner/ok/denied reutilizando `video_is_publicly_distributable`), única vía
  de escritura `report_video_view` (SECURITY DEFINER, fail-closed, anti-inflado
  en **tiempo de pared REAL**: la PRIMERA petición de una sesión nueva solo CREA
  la fila con `watch_seconds = 0`; delta acotado a 60 s por petición, a
  `elapsed * 1 + 2,5 s` y a `session_age * 1 − ya contado` — sin margen +30/+60,
  de modo que una llamada inmediata suma 0 y una qualified view exige ~3 s
  reales—; `plays` solo con ≥ 120 s; qualified idempotente ≥ 3 s — o vídeo
  corto ≤ 10 s con progress ≥ 0.5 y watch ≥ 2 —; completed con progress ≥ 0.95
  y watch ≥ min(5, 50 % duración)), matriz de moderación (solo
  `unreviewed`/`approved` aceptan watch time; `rejected`/`flagged` fallan en
  caliente sin crear filas), RPCs de lectura agregadas SECURITY DEFINER
  (`get_video_metrics`, `get_post_metrics`, `_video_metrics_aggregate` interno,
  `get_public_video_views_count` fail-closed) y permisos mínimos (tabla sin
  GRANT ni políticas SELECT; RPCs concedidas solo a anon/authenticated según
  rol).
- `supabase/tests/fase4_analytics.sql`: script de verificación SQL (transacción
  que se revierte) con 18 bloques de tests que cubren los comportamientos
  requeridos (primera petición crea fila watch=0, seek al final sin watch no
  marca, refresh inmediato no infla — watch=0 —, acumulación tras tiempo real
  acotada al tiempo de pared, un vídeo largo no se completa con un seek ni con
  2 s reales, plays solo con ≥ 120 s, umbral qualified idempotente, completion,
  delta por petición ≤ 60 s, aislamiento por identidad + RLS, nadie lee la
  tabla, métricas de propietario sin identidades, fail-closed del no
  propietario, private/rejected/flagged rechazan anon sin sesiones, sin
  auto-vistas del propietario, métricas por post + contador público, umbral de
  vídeo corto, tokens anónimos malformados, matriz de moderación con vídeo
  `approved`).
- `src/analytics/`: capa de acceso a datos (`data.ts` con `reportVideoView`,
  `getVideoMetrics`, `getPostMetrics`, `getPublicVideoViewsCount` — todas
  fail-closed devolviendo null ante error o entrada inválida —, `types.ts`,
  `schemas.ts` (zod), `config.ts` con los umbrales espejo del SQL y el umbral de
  flush, `anonymous-session.ts` con token aleatorio de 128 bits + TTL 30 días en
  localStorage, `player-tracker.ts` que acumula segundos reales ignorando
  seeks, `reporter.ts` con la lógica pura de envío (throttle por delta real,
  flush en pausa/seek/ended/desmontaje, fail-closed) y el hook
  `use-video-analytics.ts` que conecta el player con Supabase y la sesión
  anónima).
- `src/analytics/data.test.ts` y `src/analytics/reporter.test.ts`: tests
  unitarios de la capa de datos, la sesión anónima, el tracker y el reporter.
- Player integrado: `src/components/video/video-player.tsx` acepta `videoId`
  opcional y reporta watch time/progreso cuando se proporciona.
- Página pública del vídeo: `src/app/[locale]/videos/[id]/page.tsx` pasa
  `videoId` al player y muestra el contador público de vistas cualificadas solo
  para vídeos públicamente distribuibles.
- Panel del propietario: `src/app/[locale]/(app)/panel/videos/page.tsx` muestra
  por tarjeta vistas cualificadas, horas reproducidas y % completado
  (`get_video_metrics`).
- i18n: claves `viewsCount` y `metrics.*` en `messages/es.json` y `en.json`.
- `src/types/database.types.ts`: regenerado con `npm run supabase:types` tras
  aplicar la migración en remoto (incluye `video_view_sessions` y las RPCs de
  analytics).

### Verificación actual

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (175 tests, incluidos 10 de `src/analytics/reporter.test.ts`
  y 18 de `src/analytics/data.test.ts`)
- `npm run build` ✅
- Migraciones `20260812000000` y `20260813000000` **aplicadas en remoto**;
  `migration list` local=remoto (13/13).
- Test SQL `supabase/tests/fase4_analytics.sql` **sin ejecutar** (requiere stack
  local/Docker; NO debe ejecutarse contra producción).

### Pendiente / decisiones

- Ejecutar el test SQL contra el stack local cuando Docker esté disponible
  (verificación completa de los caminos autenticados y anti-inflado de
  `report_video_view`).

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
