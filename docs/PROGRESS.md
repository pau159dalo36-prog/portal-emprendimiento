# Estado del proyecto — FASE 10 (Mensajería + Notificaciones)

## Estado general

- ✅ **FASE 10 COMPLETA Y APLICADA EN REMOTO** (mensajería DM 1:1 +
  notificaciones): migración `20260822000000_fase10_messaging_notifications.sql`
  **aplicada en remoto** (`efgmjuzcqolpibraymol`, migration list local=remoto
  22/22), `supabase:types` regenerado desde el remoto,
  `lint`/`typecheck`/`test`/`build` en verde y `db push --dry-run` →
  "Remote database is up to date.". Arquitectura: UN solo pipeline de eventos
  (`interaction_events` outbox → `notifications`) sin infraestructura paralela;
  nuevos orígenes `new_follow` (trigger en `profile_follows`) y
  `message_received` (trigger en `messages`) reutilizando el MISMO outbox.
  Consumo por trigger row-level que resuelve destinatario, salta
  self-notificaciones y pares bloqueados, inserta UNA notificación por evento y
  marca `processed_at`; retención oportunista statement-level (>30 días, sin
  cron). Mensajería: `conversations` (par ordenado `dm_low/dm_high` UNIQUE →
  DM única por pareja), `conversation_members` (`last_read_at`),
  `messages` (trim/CHECK 1–2000, `edited_at`, sender/conversación inmutables,
  sin DELETE). RPCs: `get_or_create_dm` (SECURITY DEFINER idempotente,
  self-DM/bloqueos denegados), `get_unread_notification_count`,
  `get_unread_messages_total` (derivados, invoker+RLS, sin contadores mutables),
  helpers `messaging_is_member`/`messaging_dm_blocked`. ACL revoke-first exacta
  (anon CERO en las 4 tablas nuevas y en las RPCs; authenticated sin DELETE en
  messages ni INSERT directo en notificaciones/conversaciones). Bloqueos MVP:
  historial previo visible, nuevos mensajes cerrados en ambas direcciones.
  Integración candidaturas: CTA "Enviar mensaje" SOLO para accepted en
  `/panel/oportunidades/[id]/candidatos`; nunca conversaciones automáticas.
  UI: `/notificaciones`, `/mensajes`, `/mensajes/[id]`, campana+sobre con badges
  en header y entradas en sidebar (auth-only), i18n ES/EN paritaria
  (`notifications`/`notificationTypes`/`conversations`/`messages`). Realtime NO
  configurado (MVP: Server Components + revalidation). Auditorías conductuales
  contra remoto con transacciones revertidas: PIPELINE_AUDIT_PASS,
  MESSAGING_AUDIT_PASS, RETENTION_AUDIT_PASS. Test SQL
  `supabase/tests/fase10_messaging_notifications.sql` **sin ejecutar** (Docker/
  local stack pendiente; NO ejecutar contra producción).
- ✅ **FASE 8 COMPLETA Y APLICADA EN REMOTO** (candidaturas a oportunidades): migración
  `20260821000000_fase8_applications.sql` **aplicada en remoto**
  (`efgmjuzcqolpibraymol`, migration list local=remoto 21/21), `supabase:types`
  regenerado desde el remoto, `lint`/`typecheck`/`test`/`build` en verde y
  auditoría conductual de ACL contra el remoto correcta (anon: cero acceso a
  `applications`, cero INSERT/UPDATE/DELETE, sin `get_application_counts`, sin
  helpers internos; authenticated: SELECT/INSERT/UPDATE solo mediante RLS, sin
  DELETE, solo candidatura propia, managers solo candidaturas de oportunidades
  gestionadas). Verificados: `UNIQUE(opportunity_id, applicant_id)`, FKs, índices,
  CHECK de estados (`submitted|viewed|accepted|rejected|withdrawn`), lifecycle
  (submitted→viewed/accepted/rejected/withdrawn; inmutabilidad de
  `opportunity_id`/`applicant_id`/`created_at`; bloqueos simétricos impiden NUEVAS
  candidaturas; `withdrawn` no admite re-postulación MVP), elegibilidad de
  oportunidades (`opportunity_is_publicly_distributable`), one_day_shift terminado
  no admite candidatura, `accepted_count` derivado (RPC
  `get_application_counts`), `interaction_events` acepta únicamente los nuevos
  eventos `application_*`. Test SQL `supabase/tests/fase8_applications.sql`
  **sin ejecutar** (requiere stack local/Docker; NO ejecutarlo contra producción).
- ✅ **FASE 9 COMPLETA Y APLICADA EN REMOTO** (comentarios + feedback
  estructurado + reacciones + guardados): migraciones
  `20260819000000_fase9_interacciones.sql` y corrección de mínimo privilegio
  `20260820000000_fase9_min_priv_interacciones.sql` **aplicadas en remoto**
  (`efgmjuzcqolpibraymol`, migration list local=remoto 20/20), `supabase:types`
  regenerado desde el remoto (diff solo adiciones: los tipos manuales
  coincidían con el generado), `lint`/`typecheck`/`test`/`build` en verde y
  auditoría conductual de ACL contra el remoto correcta (anon lee comentarios
  públicos y ejecuta SOLO las RPC de conteo; sin escritura/lectura en
  feedback/reacciones/guardados/outbox; helpers sin EXECUTE para anon;
  service_role accede al outbox y las RPC fallan cerradas con AUTH_REQUIRED).
  Operativo: hilo de comentarios a 1 nivel con editar/ocultar/borrar lo propio,
  feedback estructurado 1 por usuario/proyecto, botón de apoyo idempotente vía
  RPC, guardados con FKs reales (`/panel/guardados`) e outbox
  `interaction_events` preparado para la FASE 10 (notificaciones), sin
  implementarlas. Cierre técnico: fix pre-push en la migración principal
  (firmas `profiles_can_interact(uuid, uuid)` en revoke/grant y eliminada la
  palabra clave inválida `invoker`; helpers concedidos SOLO a authenticated).
  Pendiente solo la ejecución del test SQL
  `supabase/tests/fase9_interacciones.sql` contra el stack local (Docker no
  disponible; NO ejecutarlo contra producción).
- ✅ **FASE 6 COMPLETA Y APLICADA EN REMOTO** (mercado de oportunidades):
  migración `20260817000000_fase6_oportunidades.sql` + corrección de mínimo
  privilegio `20260818000000_fase6_min_priv_oportunidades.sql` **aplicadas en
  remoto** (`efgmjuzcqolpibraymol`), `supabase:types` regenerado,
  `lint`/`typecheck`/`test`/`build` en verde y auditoría estructural +
  conductual read-only contra el remoto correcta (esquema, RLS, ACL con grants
  directos verificados por rol, triggers, predicado y RPC de búsqueda).
  Cierre técnico adicional: fix de regresión en el formulario (los turnos
  `one_day_shift` no enviaban `visibility` al no renderizarse el selector;
  ahora viaja como input hidden, con test), y revocados los grants residuales
  de plataforma sobre `opportunities` (anon sin INSERT/UPDATE/DELETE/TRUNCATE;
  authenticated sin DELETE/TRUNCATE; funciones de trigger sin EXECUTE externo),
  patrón ya usado en FASES 4.2/4.3. Operativo:
  `/oportunidades` ↔ `/opportunities`, publicar, editar, panel, moderación admin
  y pestaña Oportunidades en Explore. Pendiente solo la ejecución del test SQL
  `supabase/tests/fase6_oportunidades.sql` contra el stack local (Docker no
  disponible; NO ejecutarlo contra producción).
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

## FASE 9 — Comentarios, feedback, reacciones y guardados

Deliverables creados y revisados:

- `supabase/migrations/20260819000000_fase9_interacciones.sql`: siete tablas
  nuevas. `post_comments` (hilo a **máximo 1 nivel de respuesta** validado por
  trigger `post_comments_validate_thread_trigger` con error
  `COMMENT_PARENT_INVALID`; el padre debe pertenecer al mismo post; `reply_depth`
  0/1; `body` 1–2000 tras `btrim`; soft-delete/soft-hide propio vía `is_hidden`,
  `deleted_at` y `body = '[eliminado]'`; `edited_at`; inmutabilidad de
  `post_id`/`author_id`/`parent_id`). `project_feedback` (feedback estructurado:
  `understanding/problem/useful/unclear/suggestions` con longitudes acotadas,
  `would_use yes|maybe|no`, `interest_score` 0–10 opcional, `UNIQUE(project_id,
  author_id)` → **1 feedback por usuario y proyecto**, actualizable). 
  `post_reactions` (MVP solo `support`, `UNIQUE(post_id, profile_id,
  reaction_type)` → toggle idempotente). Guardados con **FKs reales, no
  polimórficos**: `saved_posts`, `saved_projects`, `saved_opportunities`
  (PK compuesta `(profile_id, item_id)`, insert solo si el contenido es
  distribuible/público). Outbox `interaction_events` (`event_type`
  `comment_created|reply_created|feedback_received|reaction_received`,
  payload JSONB) alimentado por triggers SECURITY DEFINER — sin políticas RLS
  (deniega todo) ni grants: solo service_role/triggers escriben y leen;
  preparado para FASE 10. Helpers: `profiles_can_interact(actor, owner)`
  (bloqueo en cualquier dirección impide NUEVAS interacciones, reutiliza
  `profile_blocks`), `project_is_publicly_visible(uuid)` (reutiliza el predicado
  canónico de FASE 2). RPCs SECURITY DEFINER fail-closed:
  `toggle_post_support(uuid)` (returns boolean, `POST_NOT_INTERACTABLE` si no es
  distribuible o hay bloqueo), `get_post_interaction_counts(uuid[])`
  (agregación por post, filtra no públicos — sin columnas contador mutables),
  `get_project_feedback_count(uuid)` (solo para miembros del proyecto/admin).
  RLS completa: anon solo SELECT de comentarios públicos (los ocultos/eliminados
  se excluyen del listado público); escritura solo authenticated como
  `auth.uid()` sobre contenido público y sin bloqueos; feedback legible por el
  autor y por owner/miembros/admin; guardados `select_own` exclusivo. ACL
  revoke-first + grants mínimos (patrón de fases anteriores).
- `supabase/migrations/20260820000000_fase9_min_priv_interacciones.sql`:
  corrección idempotente de mínimo privilegio (revoca defaults de plataforma y
  re-concede lo justo; funciones internas de trigger sin EXECUTE externo).
- `supabase/tests/fase9_interacciones.sql`: script de verificación SQL
  (transacción que se revierte) con 9 bloques: ACL mínima, hilo de comentarios,
  edición/ocultación/borrado propios vs ajenos, privacidad (private/hidden),
  feedback idempotente + score + self-feedback denegado + visibilidad, toggle +
  conteos agregados sin fuga, guardados idempotentes y listado propio exclusivo,
  bloqueos simétricos (nuevas interacciones denegadas, previas persisten,
  desbloqueo restaura), outbox de eventos.
- `src/types/database.types.ts`: extendido A MANO con el formato generado
  (tablas Row/Insert/Update/Relationships y Args/Returns de las 3 RPCs, orden
  alfabético). Al aplicar la migración en remoto conviene regenerar con
  `npm run supabase:types`.
- `src/config/interactions.ts` + `src/validations/interactions.ts`: constantes
  espejo de los CHECKs SQL y esquemas zod (`commentBodySchema`,
  `createCommentSchema`, `updateCommentSchema`, `projectFeedbackSchema` con
  `interest_score` opcional vía preprocess).
- `src/interactions/`: capa de datos tipada y fail-closed — `types.ts` (unión
  `InteractionErrorCode`: `EMPTY_BODY|BODY_TOO_LONG|INVALID_PARENT|
  NOT_OWN_COMMENT|NOT_ALLOWED|FAILED`), `comments.ts` (list/create/update/
  setOwnCommentHidden/deleteOwn), `feedback.ts` (upsert onConflict
  `project_id,author_id`, conteo vía RPC), `reactions.ts` (toggle/isSupported/
  conteos), `saves.ts` (save/unsave/toggle/list* con joins a posts/projects/
  opportunities).
- `src/actions/interactions.ts`: Server Actions (`createCommentAction`,
  `updateCommentAction`, `hideCommentAction`, `deleteCommentAction`,
  `upsertFeedbackAction`, `toggleSupportAction`, `toggleSaveAction`) — patrón
  FormState, `requireUser`, actor siempre `user.id`, `revalidatePath("/", "layout")`.
- UI: `src/components/interactions/{support-button,save-button,comment-composer,
  comment-actions,comment-section,feedback-form,feedback-section}.tsx`.
- Integraciones: página pública del vídeo (apoyo + guardar + hilo de comentarios
  con conteos, solo si el post es públicamente distribuible), proyecto público
  (FeedbackSection con vista de propietario), oportunidad (SaveButton).
- `src/app/[locale]/(app)/panel/guardados/page.tsx`: sección "Guardados" con las
  tres pestañas de contenido (posts/proyectos/oportunidades) y entrada nueva en
  `desktop-sidebar.tsx` (`nav.savedItems`, icono Bookmark).
- i18n: claves `interactions.*` y `savedPanel.*` + `nav.savedItems` +
  `metadata.panelSaved` en `messages/es.json` y `messages/en.json` (árboles
  idénticos verificados).
- Tests: 42 unitarios nuevos en verde — `src/interactions/comments.test.ts` (11),
  `feedback.test.ts` (8), `reactions.test.ts` (5), `saves.test.ts` (8) y
  `src/actions/interactions.test.ts` (10, incluye anon rechazado).

### Verificación actual

- `npm run lint` ✅.
- `npm run typecheck` ✅.
- `npm run test` ✅ (385 tests: 343 previos + 42 nuevos de interacciones).
- `npm run build` ✅.
- Migraciones FASE 9 **aplicadas en remoto**; `migration list` local=remoto
  (20/20); `supabase db push --dry-run` → "Remote database is up to date".
- Auditoría conductual de ACL contra el remoto ✅ (anon: lee comentarios
  públicos, ejecuta solo las 2 RPC de conteo, denegado en el resto de tablas,
  helpers sin EXECUTE y toggle no ejecutable; service_role: outbox legible y
  RPCs fail-closed con AUTH_REQUIRED sin sesión). Auditoría por rol
  authenticated pendiente de sesión real (la matriz de grants queda cubierta
  por la migración min_priv revoke-first aplicada).
- Test SQL `supabase/tests/fase9_interacciones.sql` **sin ejecutar** (requiere
  stack local/Docker; NO debe ejecutarse contra producción).

### Pendiente / decisiones

- Ejecutar el test SQL contra el stack local cuando Docker esté disponible.

## FASE 6 — Mercado de oportunidades

Deliverables creados y revisados:

- `supabase/migrations/20260817000000_fase6_oportunidades.sql`: tabla
  `opportunities` (mercado independiente de `project_needs`, que queda intacta).
  `opportunity_type` `job|internship|cofounder|collaboration|one_day_shift`
  (el primer empleo se modela con el flag `is_first_job_friendly`, no como tipo);
  compensación tipada (`compensation_type` `monetary|equity|negotiable|unpaid`,
  `compensation_period` `hour|shift|day|week|month|year|one_time`; `monetary`
  exige `currency` + periodo + al menos una cota y `min <= max`; los turnos de 1
  día solo admiten `shift`/`day`); ciclo `draft → published → closed|filled|cancelled`
  (terminal); turnos de 1 día con `starts_at`/`ends_at`/`slots_total` (un turno
  pasado NO es distribuible) y moderación post-publicación
  `unreviewed|approved|rejected|flagged`. Triggers: invoker
  `opportunities_validate_state_change` (estados válidos, prohibido publicar
  turnos pasados, moderación solo por admin, `creator_id` inmutable) y el sync
  `SECURITY DEFINER` `posts_sync_from_opportunity` (idempotente, 1 post por
  oportunidad con `post_type='opportunity'` y `opportunity_id` único; las RPC
  de feed se recrean con `post_type='video'` para que las oportunidades NO entren
  en "Para ti"/"Siguiendo"). Sin política DELETE: el ciclo de vida se gestiona
  por estados. RLS completa (select público solo distribuible, registrados,
  miembros de proyecto, admin; insert/update creador/miembro/admin) y ACL mínima
  (REVOKE de `public` + GRANT explícito; RPCs admin solo `authenticated` con
  `is_platform_admin()` interno fail-closed, patrón exacto de vídeos).
- `supabase/tests/fase6_oportunidades.sql`: script de verificación SQL
  (transacción que se revierte) con 10 bloques: esquema, RLS de lectura, RLS de
  inserción, permisos de edición, one-day shift, ciclo de vida, búsqueda y
  paginación con cursor.
- `src/opportunities/`: `constants.ts`, `types.ts`, `data.ts` (RPC
  `search_opportunities` + CRUD fail-closed), `panel.ts` (secciones del panel y
  canPublish/canClose/canFill/canCancel), `format.ts` (compensación
  "75 EUR/turno" o "30.000–35.000 EUR/año"), `map.ts` (perfil de la tarjeta +
  flags). Tests: `format.test.ts` (18) y `panel.test.ts` (11).
- `src/validations/opportunity.ts` (+ test, 11): Zod espejo de las invariantes
  SQL (one-day shift, compensación, fechas, slots). `src/actions/opportunity.ts`
  (publicar/editar/cambiar estado) y `opportunity-moderation.ts`
  (aprobar/rechazar/marcar, fail-closed admin).
- Rutas: `/oportunidades` (market), `/oportunidades/[id]` (detalle),
  `/publicar/oportunidad`, `/panel/oportunidades`, `/admin/oportunidades` y
  `/oportunidades/[id]/editar`. Explore gana la pestaña Oportunidades
  (`explore-app.tsx`, grupo con previews + CTA); nav (sidebar, bottom-nav,
  header) y panel integrados. `features.oportunidades = true`;
  `routing.ts` mapea `/oportunidades` ↔ `/opportunities`.
- i18n: claves nuevas en `messages/es.json` y `en.json` (namespaces
  `opportunity` 75, `opportunityTypes` 5, `employmentTypes` 5, `workModes` 3,
  `experienceLevels` 5, `compensationTypes` 4, `compensationPeriods` 7,
  `opportunityStatuses` 5, `opportunityForm` 52, `opportunityDates` 3,
  `moderationStatuses` 4, `industries` 11). Paridad verificada: 1127 claves
  ES = 1127 EN, 0 solo-ES, 0 solo-EN.
- `src/types/database.types.ts`: regenerado con `supabase:types` desde el
  remoto tras aplicar la migración (tabla `opportunities`, `search_opportunities`
  y las RPC admin).

### Verificación actual

- `npm run lint` ✅ / `npm run typecheck` ✅ / `npm run build` ✅
- `npm run test` ✅ (343 tests en 30 archivos, incluidos los de
  `src/opportunities`, `src/validations/opportunity` y el nuevo
  `opportunity-form.test.tsx`).
- Migraciones `20260817000000` + `20260818000000` **aplicadas en remoto**;
  `migration list` local=remoto (18/18); `supabase db push --dry-run` →
  "Remote database is up to date."
- Auditoría read-only contra el remoto ✅: tabla con RLS activo y sus 7
  políticas; ACL de funciones con REVOKE/GRANT correctos (admin RPCs solo
  `authenticated`, `search_opportunities` anon+authenticated; funciones de
  trigger sin EXECUTE externo tras la corrección de mínimo privilegio);
  atributos de seguridad (SECURITY DEFINER + `search_path=''`)
  coincidentes; triggers presentes; predicado
  `opportunity_is_publicly_distributable` verificado (draft/closed/filled/
  cancelled/flagged/rejected/turno pasado → no; publicado y turno futuro → sí);
  `search_opportunities` con todos los filtros responde sin errores (tabla
  vacía en producción); grants directos por rol verificados con
  `has_table_privilege`/`has_function_privilege` (anon: solo SELECT;
  authenticated: SELECT/INSERT/UPDATE sin DELETE/TRUNCATE).
- Test SQL `supabase/tests/fase6_oportunidades.sql` **sin ejecutar** (requiere
  stack local/Docker; NO debe ejecutarse contra producción).

### Pendiente / decisiones

- Ejecutar `fase6_oportunidades.sql` (y el resto de tests SQL de FASE 4/5)
  contra el stack local cuando Docker esté disponible.
- Candidaturas/ATS: fuera de alcance de FASE 6 (`slots_total` es informativo;
  quedan para una fase futura).
- Las oportunidades NO entran en el feed "Para ti"/"Siguiendo" (decisión:
  viven en su market `/oportunidades`).
- FASE 6 queda lista para commit, pendiente de autorización del usuario.

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
- Migraciones local=remoto: **22/22 (hasta `20260822000000_fase10_messaging_notifications.sql`)**.
  FASE 10 aplicada, auditada en remoto y verificada (`db push --dry-run` →
  "Remote database is up to date.").
- Los tests SQL de FASE 4–FASE 10 (posts/follows/analytics/feed/search/
  oportunidades/interacciones/applications/messaging-notifications) NO deben
  ejecutarse contra producción; quedan para el stack local.
- Sin commit/push pendiente de autorización.
