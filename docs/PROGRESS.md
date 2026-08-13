# Estado del proyecto — FASE 5 (Explorar y búsqueda)

## Estado general

- ✅ **FASE 5 COMPLETA Y APLICADA EN REMOTO** (búsqueda/exploración): migraciones
  `20260815000000_fase5_search.sql` (helpers, columnas generadas `search_text`,
  índices trigram y 4 RPCs SECURITY DEFINER) + corrección
  `20260816000000_fase5_min_priv_search.sql` **aplicadas en remoto**,
  `supabase:types` regenerado, `lint`/`typecheck`/`test`/`build` en verde y
  verificación read-only contra el remoto correcta (normalización, RPCs anon,
  cursor, índices y ACL) y **Explore/search operativo** (`/explorar` ↔ `/explore`).
  Pendiente solo la ejecución del test SQL
  `supabase/tests/fase5_search.sql` contra el stack local (Docker no disponible;
  NO ejecutarlo contra producción).
- ✅ **FASE 4 COMPLETA** (4.1 posts, 4.2 follows, 4.3 analytics, 4.4 feed y cierre
  4.5): todo verificado (`lint`/`typecheck`/`test`/`build` en verde), remoto
  sincronizado y documentado. Pendiente solo la ejecución de los tests SQL
  `fase4_posts/follows/analytics/feed.sql` contra un stack local (Docker no
  disponible; NO ejecutarlos contra producción).
- ✅ **FASE 4.4 aplicada en remoto**: migración
  `20260814000000_fase4_4_feed.sql` (migration list local=remoto 13/13), tipos
  regenerados con `npm run supabase:types` (+88 filas solo RPC feed) y ACL
  auditadas estructural y conductualmente contra el remoto.
- ✅ **FASE 4.3 aplicada en remoto**: migración `20260812000000_fase4_3_analytics.sql`
  + corrección de mínimo privilegio `20260813000000_fase4_3_min_priv_analytics.sql`
  aplicadas, tipos regenerados y verificación completa `npm run check` en verde.
- ✅ **FASE 4.2 aplicada en remoto** (`20260810000000_fase4_follows.sql` +
  corrección `20260811000000_fase4_2_min_priv_follows.sql`), tipos regenerados
  y verificaciones read-only correctas.
- ✅ **FASE 4.1 aplicada** (migración `20260809000000` en remoto).
- ✅ **FASE 3 completada** (subida, imágenes, publicación, moderación,
  reproductor, portada, panel, tests y docs).

## FASE 5 — Explorar y búsqueda

Deliverables creados y revisados:

- `supabase/migrations/20260815000000_fase5_search.sql`: helpers
  `search_normalize(text)` (normalización no estricta con `search_path=''`),
  `search_array_to_text(text[])` (envuelve `array_to_string`, `STABLE` en
  Postgres ≥ 16, dentro de una función `IMMUTABLE` para poder usarla en las
  columnas generadas) y `search_recency(timestamptz, timestamptz default now())`
  (fail-closed, devuelve 0 ante NULL) + cuatro RPCs
  `SECURITY DEFINER` (`search_profiles`, `search_projects`,
  `search_organizations`, `search_videos`) que devuelven en UNA llamada el
  payload completo del item (sin N+1), `is_following` por fila y el `search_score`.
  Fórmula de query: `0.60*similarity(trigram) + 0.25*ts_rank(to_tsquery) +
  0.15*recency`; en browse sin query, perfiles/proyectos/organizaciones ordenan
  por recencia y los vídeos por `0.85*recencia + 0.15*engagement`
  (`ln(1+plays)/ln(101)`, referencia 100 plays). Cursor `(score, created_at,
  id)` con orden SQL estable; `sort` `relevance`/`recent`; filtros
  `role`/`language`/`stage`/`industry`. Excluyen perfiles privados, contenido no
  distribuible, moderación `rejected`/`flagged` y los autores que bloquean al
  lector (y al revés). ACL mínima: REVOKE de EXECUTE a `public` y re-GRANT a
  `anon`+`authenticated` de los 4 RPCs y de `search_normalize`/
  `search_array_to_text` (las columnas generadas los invocan al ESCRIBIR con los
  privilegios del escritor). `search_recency` NO se concede. Índices GIN de
  trigramas sobre `search_text` y GIN sobre los arrays de filtro.
- `supabase/migrations/20260816000000_fase5_min_priv_search.sql`: corrección de
  mínimo privilegio. Los default privileges de Supabase habían concedido
  EXECUTE de `search_recency` a `anon`/`authenticated` al crearla (la migración
  principal solo revocaba de `public`); se revoca de `anon`/`authenticated` para
  que no quede expuesta por PostgREST (solo corre dentro de las RPCs SECURITY
  DEFINER).
- `src/search/`: `config.ts` y `ranking.ts` **espejan la fórmula exacta del SQL**
  (pesos 0.60/0.25/0.15, half-life 30 días, `videoBrowseScore`), `schemas.ts`
  con `exploreParamsSchema` (Zod con fallback seguro: un query string inválido
  NUNCA devuelve 500), `buildExploreQuery` (URL canónica, omite valores por
  defecto) y `EXPLORE_TABS`; `data.ts` (4 RPCs, cursor opaco versionado y
  frontera honesta con la nullabilidad real de LEFT JOIN); `home.ts` (primera
  página de cada pestaña server-side con los params completos, sin scores en el
  payload).
- UI `/explorar`: `page.tsx` con validación Zod server-side, SEO `noindex,
  follow` cuando hay `?q=` y `key` = serialización de params (remontaje limpio);
  `explore-app.tsx` con pestañas **Todo** (vista agrupada con previews de 4 +
  CTA "Ver más"), Vídeos, Proyectos, Organizaciones y Perfiles; la URL es la
  fuente de verdad (cambiar pestaña/orden/filtro navega con `router.replace`);
  chips de filtros activos con "Limpiar filtros"; orden relevancia/recientes y
  filtros por rol, idioma, etapa e industria según pestaña; "Cargar más"
  client-side con cursor (merge sin duplicados, el error NUNCA descarta items
  ya cargados); estados vacíos y de error con reintento; responsive por
  `flex-wrap` (sin Sheet/Drawer).
- `ProfileCard` con `FollowButton` (solo para sesión autenticada y perfil ajeno;
  `currentUserId` llega del server). El header ya busca en `/explorar?q=`.
- i18n: claves nuevas `tabAll`, `seeMore`, `seeMoreSr`, `activeFilters`,
  `removeFilter`, `clearFilters` en `messages/es.json` y `en.json`.
- Tests: `ranking.test.ts` (17) verifica la fórmula espejo (incluida la
  coincidencia con la migración), `schemas.test.ts` (7) los params de
  `/explorar` y `explore-app.test.tsx` (19) la UI (pestañas, navegación, chips,
  load-more, búsqueda y visibilidad del botón seguir). Total `src/search` +
  `src/components/explore`: 50 tests.
- `src/types/database.types.ts`: regenerado con `supabase:types` desde el remoto
  tras aplicar las migraciones (incluye `search_text` en las 4 tablas y las 4
  RPCs de búsqueda; el generador marca `returns table` non-null, la frontera
  `src/search/data.ts` aplica el cast honesto).

### Verificación actual

- `npm run typecheck` ✅ / `npm run lint` ✅ / `npm run build` ✅
- `npm run test` ✅ (288 tests en 24 archivos, incluidos 50 de `src/search` +
  `src/components/explore`).
- Migraciones `20260815000000` y `20260816000000` **aplicadas en remoto**;
  `migration list` local=remoto (16/16).
- Verificación read-only contra el remoto (transacción con rollback) ✅:
  `search_text` poblada en todos los registros existentes; normalización
  correcta (`José` → `jose`, arrays `{emprendedor}` → texto); RPCs devuelven
  resultados reales en browse y con query; cursor página 1+2 sin overlap;
  los 8 índices presentes; anon puede ejecutar las 4 RPCs y NO puede ejecutar
  `search_recency` (permission denied → fail-closed).
- Test SQL `supabase/tests/fase5_search.sql` **sin ejecutar** (requiere stack
  local/Docker; NO debe ejecutarse contra producción).

### Pendiente / decisiones

- Ejecutar `fase5_search.sql` (y el resto de tests SQL de FASE 4) contra el
  stack local cuando Docker esté disponible.
- FASE 6 NO ha empezado (este cierre deja FASE 5 implementada, aplicada y
  verificada en remoto).

## FASE 4.4 — Feed ("Para ti" y "Siguiendo")

Deliverables creados y revisados:

- `supabase/migrations/20260814000000_fase4_4_feed.sql`: dos RPC `SECURITY
  DEFINER` (`get_for_you_feed`, `get_following_feed`) que devuelven en UNA
  llamada el post + vídeo + autor + proyecto + organización + métricas agregadas
  (sin N+1; los índices existentes cubren el plan). Ranking "Para ti"
  determinista con la fórmula espejada en `src/feed/config.ts` y `ranking.ts`:
  `0.35*recency` (half-life 168 h) + `0.15*affinity` (cap 1.0) +
  `0.20*watch` + `0.10*completion` (smoothing bayesiano prior 10 vistas) +
  `0.10*views` (log1p/10) + `0.10*explore` (exp(-log1p/20)), score en `[0,1]`
  redondeado a 6 decimales; cursor `(score, published_at, id)`. "Siguiendo" es
  cronológico (`published_at DESC, id DESC`) sin reordenar. Excluye contenido no
  distribuible, `unlisted`, moderación `rejected`/`flagged` y a los autores que
  bloquean al lector (y al revés). Anónimos reciben "Para ti" (afinidad 0).
  ACL: `get_for_you_feed` anon+authenticated, `get_following_feed` solo
  authenticated; se concedió EXECUTE de los predicados
  `post_is_publicly_distributable`/`video_is_publicly_distributable` a
  anon+authenticated porque las políticas RLS los invocan con los privilegios
  del llamador. Sin tablas/triggers/índices nuevos.
- `src/feed/`: `config.ts` (pesos/límites espejo), `ranking.ts` (capa pura
  determinista con breakdown), `diversity.ts` (reordena DENTRO de cada página;
  máx 2 autores consecutivos, sin eliminar candidatos, no toca el cursor),
  `schemas.ts` (cursor opaco versionado, límite [1,50]), `data.ts` (RPC +
  frontera con nullabilidad real de LEFT JOIN — `ForYouFeedRow`/
  `FollowingFeedRow` — y `video: null` cuando no hay vídeo), `home.ts`
  (primera página server-side, elimina los `scores` del payload), `types.ts`
  (`PublicFeedItem` sin scores para la UI).
- UI: `src/app/[locale]/page.tsx` (homepage = feed), `feed-tabs.tsx` (dos
  pestañas, "Siguiendo" gated a sesión, "Cargar más" con cursor sin OFFSET,
  merge sin duplicados por `post.id`, el error NUNCA descarta items ya
  cargados, reintentar, estados vacíos con CTA Explorar), `feed-post-card.tsx`
  (tarjeta con fallback de miniatura, autor/avatar, vistas públicas).
- Homepage verificada: `src/app/[locale]/page.tsx` → `loadHomeFeed` →
  `FeedTabs`. `/videos`, `/proyectos`, `/organizaciones` siguen siendo
  directorios propios (la homepage solo aloja el feed).
- Tipos regenerados (`supabase:types`): +88 solo de las dos RPC del feed.
  Nota: el generador marca `returns table` como non-null; en runtime las
  columnas de LEFT JOIN devuelven `null` reales, por eso la frontera
  `src/feed/data.ts` hace el cast honesto (y `video: null` cuando `video_id`
  es nulo) con su test.
- Auditoría de ACL contra el remoto (estructural + conductual con
  `db query --linked` + `set local role`/`request.jwt.claim.sub`): anon puede
  ejecutar `get_for_you_feed` y los predicados de distribución; `get_following_feed`
  y `_video_metrics_aggregate` NO son ejecutables por anon; no hay suplantación
  de identidad (las RPC usan `auth.uid()`, no un `p_user_id`).
- Prueba read-only del feed contra producción (transacción con rollback):
  paginación 12+5 sin duplicados ni overlap, contenido no distribuible excluido,
  moderación `rejected`/`flagged` excluida.
- Cierre 4.5: se eliminó `listFeedPosts` (`src/posts/data.ts`), primitiva
  supersedida por las RPC del feed (solo la usaban sus tests); se conservan los
  tests de la matriz de distribución. `getPostById`/`listPostsForUser` y
  `getPostMetrics` quedan como capas de datos testeadas para páginas futuras de
  detalle de post.

### Verificación actual

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (235 tests en 20 archivos)
- `npm run build` ✅
- Migración `20260814000000` **aplicada en remoto**; `migration list`
  local=remoto (13/13); `supabase db push --dry-run` → "Remote database is up
  to date."
- Test SQL `supabase/tests/fase4_feed.sql` **sin ejecutar** (requiere stack
  local/Docker; NO debe ejecutarse contra producción).

### Pendiente / decisiones

- Ejecutar `fase4_feed.sql` (y `fase4_posts/follows/analytics`) contra el stack
  local cuando Docker esté disponible.
- FASE 5 implementada (ver sección FASE 5; pendiente aplicar la migración en
  remoto y ejecutar `fase5_search.sql` en el stack local).

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
- Migraciones local=remoto: **16/16 (hasta `20260816000000_fase5_min_priv_search.sql`)**.
  FASE 5 aplicada y verificada en remoto.
- Los tests SQL de FASE 4 y FASE 5 (posts/follows/analytics/feed/search) NO
  deben ejecutarse contra producción; quedan para el stack local.
- Sin commit/push pendiente de autorización.
