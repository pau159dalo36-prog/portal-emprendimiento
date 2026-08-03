# PROGRESO del proyecto

Estado de cada fase según el plan de implementación global. Se actualiza al
finalizar cada fase, junto con las verificaciones obligatorias
(lint, TypeScript, tests, build, RLS, rutas, responsive, accesibilidad).

Leyenda: ⬜ pendiente · 🔵 en curso · ✅ completada.

## FASE 0 — Auditoría y baseline

Estado: ✅ completada (2026-08-03).

Realizado:
- Lectura completa de código, migraciones, docs y configuración.
- Comandos no destructivos: `git status`, `git remote`, `npm run lint`,
  `npm run typecheck`, `npm run build`, `npx supabase migration list`,
  `npx supabase gen types typescript --linked`.
- Reconciliación: local = remoto en la migración `20260731000000`.
- Regeneración de `src/types/database.types.ts` (drift solo en `graphql_public`).
- Creación de `docs/CURRENT_STATE_AUDIT.md`.

Verificaciones FASE 0:
- [x] lint (`npm run lint`)
- [x] TypeScript (`npm run typecheck`)
- [x] build (`npm run build`)
- [x] tests (no existen aún; se configurarán en FASE 1)
- [x] RLS revisada (4 tablas + storage `avatars`)
- [x] Rutas revisadas (build lista 17 rutas)
- [ ] responsive / accesibilidad (pendiente auditoría específica)
- [x] Sin secretos en repositorio
- [x] Migraciones sincronizadas local ↔ remoto

Pendiente de FASE 0 (manual, requiere acciones de usuario):
- Instalar Docker si se desea `supabase db lint` / `supabase db dump`.
- Crear y enlazar el sitio Netlify (para `netlify:build`).

Despliegue en producción (2026-08-03, verificado):
- [x] Sitio Netlify creado y enlazado: `https://sensational-squirrel-26a2f8.netlify.app`.
- [x] Variables de entorno configuradas en Netlify.
- [x] `site_url` y redirects de Supabase Auth actualizados con la URL pública.
- [x] `GET /api/health` responde `{ "status": "ok" }` en producción.
- [x] Flujo de autenticación verificado en producción.

## FASE 1 — Marca, arquitectura, internacionalización y perfiles globales

Estado: ✅ completada (2026-08-03).

Realizado:
- Marca centralizada en `src/config/brand.ts` (`name: "Ideora"`, `logoMark`, `pageTitle()`, navegación).
- Internacionalización español/inglés con `next-intl@4.13.4`:
  - Rutas con prefijo de idioma (`/es`, `/en`) vía `src/i18n/routing.ts`, `src/proxy.ts`
    (composición `createMiddleware(routing)` + `updateSession`) y `src/i18n/navigation.ts`.
  - Catálogos completos `messages/es.json` y `messages/en.json`.
  - Server Actions traducidas (`actions/auth.ts`, `actions/profile.ts`, `actions/avatar.ts`)
    y validaciones como factories `create*Schema(t)`.
  - Páginas de perfil/públicas/onboarding/panel/configuración traducidas con `getTranslations`.
  - Selector de idioma `LocaleSwitcher` + página `/configuracion/idioma`.
  - Redirecciones con locale: `redirect(getPathname({ href, locale }))` (`next/navigation`),
    resolviendo el control-flow de TypeScript (TS2355/TS2366/TS18047).
- Configuración de verificaciones: vitest configurado (`completion.test.ts`, `map.test.ts`).
- Migración FASE 1 aplicada en producción (`supabase db push --linked`, 2026-08-03):
  `supabase/migrations/20260803000000_fase1_profiles_extended.sql`
  - `profiles`: nuevas columnas `contact_email` y `timezone` (nullable, con CHECK).
  - Tablas nuevas: `professional_roles` (catálogo con 7 roles), `profile_languages`,
    `profile_experience`, `profile_education`, `profile_links`, `profile_achievements`,
    `profile_preferences` (1:1), `profile_blocks`, `profile_follows`.
  - RLS activado en las 9 tablas nuevas con políticas de lectura pública (solo si el
    perfil es público), CRUD del propietario, y en `profile_follows` además la consulta
    de seguidores; `profile_blocks`/`profile_follows` sin lectura anónima.
  - Permisos mínimos (`GRANT`) y `src/types/database.types.ts` regenerado
    (`npm run supabase:types`).
- Ajuste: script `supabase:db:push` corregido a `supabase db push --linked`
  (el flag `--project-ref` ya no existe en la CLI 2.110.0).

Verificaciones FASE 1:
- [x] lint (`npm run lint`)
- [x] TypeScript (`npm run typecheck`)
- [x] build (`npm run build`)
- [x] tests (`npm run test`)

Pendiente opcional (fuera del alcance verificado de FASE 1):
- `src/config/features.ts` y `src/config/uploads.ts`.
- Documentación: PRODUCT_VISION, SECURITY, INTERNATIONALIZATION, etc.

## FASE 2 — Organizaciones y proyectos

Estado: ✅ completada (2026-08-04).

Objetivo: organizaciones y proyectos de extremo a extremo — tablas con
restricciones/índices/triggers y RLS; validación Zod; Server Actions; páginas
localizadas ES/EN (crear, editar, publicar, privacidad, listado/exploración,
perfiles de organizaciones y proyectos); gestión de miembros, roles,
necesidades y enlaces. Sin vídeos ni feed (FASES 3 y 4).

Realizado:
- Migración aplicada en producción (`npx supabase db push --linked`,
  2026-08-04): `supabase/migrations/20260804000000_fase2_organizations_projects.sql`
  - Tablas: `organizations`, `organization_members`, `organization_links`,
    `projects`, `project_members`, `project_needs`, `project_links`.
  - Catálogos en base: `organization_member_roles`, `project_member_roles`,
    `organization_link_types`, `project_link_types`, `project_stages`,
    `project_statuses`, `need_statuses`.
  - RLS por fila (select público vs. dueño/miembro), grants mínimos, triggers
    (`updated_at`, slug, auto-membresía del dueño, protección de `id`).
  - Funciones SQL `SECURITY DEFINER` con `set search_path = ''`
    (`is_organization_member`, `is_organization_manager`,
    `is_project_member`) para evitar recursión de RLS; guardas impiden editar
    la fila del owner real.
  - `src/types/database.types.ts` regenerado (`npm run supabase:types`).
- Catálogos i18n ES/EN completados y validados (`metadata`, `nav`, `avatar`,
  `industries`, `projectStages`, `projectStatuses`, `orgRoles`,
  `projectRoles`, `needStatuses`, `linkTypes`, `organizations`, `projects`,
  `organizationForm`, `projectForm`, `managers`, `actions.organization`,
  `actions.project`, validaciones nuevas, `validation.labels`).
- Validaciones Zod: `src/validations/organization.ts`, `src/validations/project.ts`,
  `src/validations/fields.ts` (helpers `createSlugSchema`,
  `createEnumArraySchema`, `createIsCheckedSchema`, opcionales).
- Server Actions traducidas: `src/actions/organization.ts`,
  `src/actions/project.ts` (crear/editar miembros, enlaces, necesidades,
  roles, estados; comprobación de permisos con `getClaims()`).
- Helpers de datos: `src/organizations/data.ts` (`isOrganizationMember`,
  `isOrganizationManager`, `listOrganizationsForUser`),
  `src/projects/data.ts` (`isProjectMember`, consultas de detalle).
- Mappers puros: `src/organizations/map.ts`, `src/projects/map.ts`.
- Componentes: `public-header.tsx`, `signed-in-nav.tsx` (enlaces nuevos),
  `member-manager.tsx`, `link-manager.tsx` (genéricos), `organization-form.tsx`,
  `project-form.tsx`, `need-manager.tsx`, `org-card.tsx`, `project-card.tsx`,
  `project-filters.tsx`.
- Páginas públicas: `/[locale]/organizaciones` (lista), `/[locale]/organizaciones/[slug]`,
  `/[locale]/proyectos` (explorar con filtros vía `searchParams`),
  `/[locale]/proyectos/[slug]`.
- Páginas autenticadas: `(app)/organizaciones/nueva`, `(app)/organizaciones/[slug]/editar`
  (miembros/enlaces solo owner), `(app)/proyectos/nuevo`,
  `(app)/proyectos/[slug]/editar` (owner gestiona core/equipo; miembros
  gestionan necesidades/enlaces).
- Navegación: `signed-in-nav.tsx` y `brand.links` actualizados con rutas de
  organizaciones y proyectos.
- Ajustes Zod v4: `createEnumArraySchema` devuelve `ZodArray` (no `preprocess`)
  para que `.max()` exista y el tipo de salida no se amplíe a `any`;
  `validationState` acepta `flatten().fieldErrors` como `unknown` (en Zod v4 los
  esquemas primitivos devuelven `string`).
- Tests de unidades puras: `src/validations/organization.test.ts` (10),
  `src/validations/project.test.ts` (8).

Verificaciones FASE 2:
- [x] lint (`npm run lint`)
- [x] TypeScript (`npm run typecheck`)
- [x] build (`npm run build`) — 25 rutas incluidas las nuevas
- [x] tests (`npm run test`) — 24 tests en 4 ficheros
- [x] Migración aplicada en producción y RLS auditada
- [x] Catálogos i18n ES/EN válidos

Pendiente opcional (fuera del alcance de FASE 2):
- Auditoría manual responsive/accesibilidad de las nuevas páginas.
- Comprobación en vivo del flujo crear→editar→miembros→necesidades en la
  instancia desplegada.

## FASE 3 — Storage, vídeos y publicación de vídeo

Estado: ⬜ pendiente.

## FASE 4 — Publicaciones, feed, visualizaciones y seguimiento

Estado: ⬜ pendiente.

## FASE 5 — Explorar, búsqueda y filtros

Estado: ⬜ pendiente.

## FASE 6 — Oportunidades, empleos y cofundadores

Estado: ⬜ pendiente.

## FASE 7 — Freelancers, servicios, financiación y clientes piloto

Estado: ⬜ pendiente.

## FASE 8 — Candidaturas y gestión de equipos

Estado: ⬜ pendiente.

## FASE 9 — Comentarios, feedback, reacciones y guardados

Estado: ⬜ pendiente.

## FASE 10 — Mensajería y notificaciones

Estado: ⬜ pendiente.

## FASE 11 — Comunidades, eventos y retos

Estado: ⬜ pendiente.

## FASE 12 — Moderación, administración y privacidad

Estado: ⬜ pendiente.

## FASE 13 — Analítica, SEO, accesibilidad y rendimiento

Estado: ⬜ pendiente.

## FASE 14 — Auditoría final, documentación y despliegue

Estado: ⬜ pendiente.

---

## Registro de fases (detalle)

### FASE 0 (completada)

Archivos creados:
- `docs/CURRENT_STATE_AUDIT.md`
- `docs/PROGRESS.md`

Archivos modificados:
- `src/types/database.types.ts` (regenerado desde el remoto).

Migraciones: ninguna (sin cambios de esquema).
Políticas RLS: ninguna nueva.
Buckets: ninguno nuevo.
Comandos ejecutados: `npx supabase migration list`, `npx supabase gen types
typescript --linked`, `npm run lint`, `npm run typecheck`, `npm run build`.
Resultados: lint ✅ · typecheck ✅ · build ✅.
Riesgos: `db lint`/`db dump` requieren Docker (siguen pendientes).
Despliegue: sitio Netlify creado, enlazado y desplegado en
`https://sensational-squirrel-26a2f8.netlify.app`; ENV configuradas; Supabase
Auth (`site_url` + redirects) apuntando a la URL pública; `/api/health` y el
flujo de auth verificados en producción.
Acciones manuales pendientes: instalar Docker (opcional) para
`supabase db lint` / `supabase db dump`.
Próxima fase: FASE 1 — marca, arquitectura, internacionalización y perfiles
globales.
