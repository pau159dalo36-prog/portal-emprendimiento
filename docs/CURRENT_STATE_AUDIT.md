# Auditoría del estado actual (FASE 0)

Fecha de auditoría: 2026-08-03.
Método: lectura completa de código y documentación + comandos no destructivos
(`git status`, `git remote`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npx supabase migration list`, `npx supabase gen types typescript --linked`).
No se ha modificado la base de datos. Sitio desplegado en Netlify (ver sección 4).

---

## 1. Estado real del código

- **Framework**: Next.js `16.2.12` (App Router, Turbopack), React `19.2.4`.
- **Lenguaje**: TypeScript 5 con `strict: true` en `tsconfig.json`.
- **Estilos**: Tailwind CSS 4 + shadcn/ui sobre **Base UI** (`@base-ui/react`).
- **Autenticación**: Supabase Auth vía `@supabase/ssr` (`^0.12.4`) y `@supabase/supabase-js` (`^2.111.0`).
- **Validación**: Zod 4 (`^4.4.3`).
- **Proxy de sesión**: `src/proxy.ts` (convención Next.js 16), que renueva la sesión con `updateSession()` y valida identidad con `supabase.auth.getClaims()`.
- **Identidad en servidor**: `getCurrentUser()` / `requireUser()` en `src/auth/session.ts` usan `getClaims()` (nunca `getSession()` para autorización).
- **Clientes Supabase**: `src/lib/supabase/client.ts` (navegador), `server.ts` (servidor), `proxy.ts` (proxy), `session-cookie.ts` (cookies `Secure` en producción y "recordarme" 30 días).
- **Entorno**: `src/lib/env.ts` centraliza `getSupabaseUrl()`, `getSupabasePublishableKey()` y `getSiteUrl()` (fallback `http://localhost:3000` en desarrollo; obligatoria en producción).
- **Server Actions**: `src/actions/auth.ts`, `profile.ts`, `avatar.ts`. Route Handlers: `src/app/auth/{callback,confirm,reset-password}/route.ts` y `src/app/api/health/route.ts`.
- **Branches**: rama `main`. Remote: `origin` → `https://github.com/pau159dalo36-prog/portal-emprendimiento.git`.
- **Estado Git**: árbol limpio salvo `src/types/database.types.ts` (reconciliado en esta auditoría, ver sección 5).
- **Últimos commits**:
  - `bd1646e` chore: preparar despliegue en Netlify.
  - `cbbe051` feat: complete authentication and user profiles.
  - `ab39310` Initial commit from Create Next App.

### Scripts de `package.json` (operativos)

- `dev`, `build`, `start`, `lint`, `typecheck`, `check` (lint + typecheck + build).
- `netlify:dev`, `netlify:build`.
- `supabase:link`, `supabase:config:push`, `supabase:db:push`, `supabase:types`.
- **No existen** `test`, `test:unit`, `test:e2e` ni `supabase:db:lint`.

### Versiones

- Node local: `v24.16.0` (npm `11.13.0`). `.nvmrc` = `24`. `engines.node` = `>=24.0.0 <25`.
- Next.js 16.2.12 requiere Node mínimo 20.9 (documentado en la instalación local). Compatible.

## 2. Estado de la base de datos

- Proyecto Supabase remoto: `efgmjuzcqolpibraymol` (enlazado con Supabase CLI; `supabase/.temp/` presente).
- `npx supabase migration list` muestra **local = remoto = `20260731000000`** en `2026-07-31 00:00:00`. **Sin divergencia**.
- Esquema real según `npx supabase gen types typescript --linked` (verificado byte a byte contra los tipos versionados, ver sección 5):
  - Tablas públicas: `profiles`, `skills`, `profile_skills`, `profile_interests`.
  - Esquema `graphql_public` con la función `graphql` expuesta en remoto.
  - No hay tablas públicas adicionales.
- Buckets de Storage: la migración crea/configura el bucket público `avatars` (5 MB, MIME imagen). No se ha podido confirmar el contenido del bucket por CLI sin Docker (ver sección 7).
- RLS activo en `profiles`, `skills`, `profile_skills`, `profile_interests`.
- Políticas definidas en la migración: `profiles_select_public`, `profiles_select_own`, `profiles_update_own`, `skills_select_all`, 5 políticas en `profile_skills` y 5 en `profile_interests`, y 4 políticas de Storage en `storage.objects` (`avatars_public_read`, `avatars_insert_own`, `avatars_update_own`, `avatars_delete_own`).
- Triggers: `on_auth_user_created` (crea perfil al registrarse), `profiles_set_updated_at`, `profiles_normalize_username`, `profiles_prevent_id_change`.
- Funciones SQL: `handle_new_user`, `handle_updated_at`, `normalize_profile_username`, `profiles_prevent_id_change` (todas `security definer` con `set search_path = ''`).
- Permisos (`GRANT`): lectura pública mínima, `UPDATE` sobre `profiles` solo autenticado, DML completo sobre `profile_skills`/`profile_interests` solo autenticado. `auto_expose_new_tables` desactivado.

## 3. Estado de las migraciones

- Una única migración local y remota: `supabase/migrations/20260731000000_create_profiles_skills_interests.sql`.
- Local y remoto sincronizados (mismo timestamp en `supabase_migrations.schema_migrations`).
- No hay historial previo; no fue necesaria una migración *baseline* porque el esquema remoto coincide con la migración existente.

## 4. Funcionalidades operativas (verificadas)

1. **Registro** por correo/contraseña (`signUpAction`) con confirmación y `emailRedirectTo` basado en `getSiteUrl()`.
2. **Confirmación de correo** (`/auth/confirm`).
3. **Inicio de sesión** (`signInAction`) con opción "recordarme".
4. **Cierre de sesión** (`signOutAction`).
5. **Recuperación de contraseña** (`requestPasswordResetAction` → `/auth/reset-password`).
6. **Actualización de contraseña** (`updatePasswordAction` → `/actualizar-contrasena`).
7. **Onboarding en 5 pasos** con guardado incremental (`saveOnboardingStepAction`).
8. **Edición de perfil** (`updateProfileAction`).
9. **Perfil público** `/perfil/[username]` (respeta RLS; 404 si privado o inexistente).
10. **Panel privado** `/panel` con % de completitud (12 secciones).
11. **Avatar** (subida, reemplazo, borrado, compresión en cliente, validación de firma en servidor).
12. **Protección de rutas** (`requireUser()` en layout `(app)`).
13. **Supabase SSR** completo (client/server/proxy) con `@supabase/ssr`.
14. **Endpoint de salud** `GET /api/health` → `{ "status": "ok" }`.
15. **Despliegue Netlify** preparado: `netlify.toml`, `.nvmrc`, `engines`, `netlify-cli`, scripts, `docs/NETLIFY.md`.
16. **Despliegue en producción** (verificado 2026-08-03): sitio Netlify creado y
    enlazado en `https://sensational-squirrel-26a2f8.netlify.app`; variables de
    entorno configuradas en Netlify; `site_url` y redirects de Supabase Auth
    actualizados con la URL pública; `GET /api/health` y el flujo de
    autenticación verificados en producción.

## 5. Reconciliación realizada (tipos TypeScript)

- `src/types/database.types.ts` (versionado) **difería** de los tipos generados desde el remoto.
- Diferencias encontradas **solo** en el esquema `graphql_public`: el remoto expone la función `graphql` (RPC), que el archivo versionado no reflejaba. El esquema `public` era idéntico.
- Decisión: regenerar el archivo de tipos con `npx supabase gen types typescript --linked` y sustituir `src/types/database.types.ts`.
- Verificación posterior: `lint` ✅, `typecheck` ✅, `build` ✅. No hay impactos funcionales (el código consume `Database["public"][...]`, sin cambios en ese esquema).

## 6. Riesgos

| Riesgo | Severidad | Estado / mitigación |
| ------ | --------- | ------------------- |
| `supabase db lint` y `supabase db dump --linked` requieren Docker Desktop | Baja | Docker no está disponible en esta máquina. Son comandos opcionales; se documentan como pendientes. |
| `user_types` en `profiles` es un `text[]` con CHECK rígido (7 valores) | Media (futuro) | La nueva visión exige tipos de usuario extensibles. Se ampliará en FASE 1 con migración y nueva estructura (p. ej. `professional_roles`). |
| Idioma/especificación de marca no centralizados | Media (futuro) | Textos "Portal de emprendimiento" dispersos en páginas. Se centralizará en `src/config/brand.ts` (FASE 1). |
| Sin sistema de tests | Media (futuro) | No existen `vitest`/`playwright`. Se añadirán en fases posteriores. |
| `site_url` y redirects de Supabase Auth apuntan a `http://localhost:3000` | Baja (resuelta) | Actualizados a la URL pública de Netlify en producción. Pendiente verificar con la CLI si se desea. |

## 7. Inconsistencias detectadas

1. **Tipos generados vs versionados** (resuelto, ver sección 5): solo `graphql_public`.
2. **`config.toml`**: `additional_redirect_urls` incluye `http://localhost:3000/auth/update-password`, ruta que **no existe** (la real es `/auth/reset-password` → `/actualizar-contrasena`). Inofensiva; se limpiará cuando se actualicen las URLs de producción.
3. **`.gitignore` raíz ignora `next-env.d.ts`**: convención recomendada es versionarla. No bloquea; se decide mantenerla ignorada (Next la regenera en cada build).
4. **Documentación de despliegue**: `docs/ARCHITECTURE.md` indica "Despliegue: Por definir"; deberá actualizarse en FASE 1 para reflejar Netlify/OpenNext.

## 8. Limitaciones de la auditoría

- No se pudo inspeccionar el contenido de los buckets de Storage ni enumerar políticas remotas con `db dump` (requiere Docker).
- No se ejecutó `supabase db lint` (requiere base local / Docker).
- La cuenta de Supabase CLI está autenticada por sesión guardada (no por variable de entorno); no se ha expuesto ni verificado ningún token.
- La API de Netlify no se consultó con token; la verificación de producción fue funcional (URL pública, `/api/health`, auth).

## 9. Decisiones tomadas

1. **No crear migración *baseline***: local y remoto ya coinciden en la migración `20260731000000`.
2. **Regenerar tipos** `src/types/database.types.ts` para que reflejen el remoto real.
3. **No modificar la BD ni ejecutar SQL** en esta fase (sin cambios de esquema pendientes).
4. **Desplegar en Netlify** (acción realizada): sitio creado y enlazado, ENV configuradas, Supabase Auth apuntando a la URL pública.
5. **Mantener la rama `main`** como rama de despliegue (coincide con la doc de Netlify).
6. **Pendiente de documentación a completar en fases posteriores**: productos futuros (vídeo, feed, oportunidades, mensajería, etc.) no existen todavía ni en código ni en BD; no se declaran como operativos.

## 10. Próximos pasos

- FASE 1: marca (`src/config/brand.ts`), arquitectura, internacionalización (español/inglés) y ampliación de perfiles (migración no destructiva + nuevas tablas normalizadas).
- Actualizar `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, crear `docs/PRODUCT_VISION.md` y demás documentos de arquitectura.

## 11. Actualización FASE 1 (2026-08-03)

Estado real tras completar la i18n:

- Internacionalización completada y verificada (`npm run lint` / `typecheck` / `test` / `build` ✅):
  rutas con prefijo de idioma, catálogos `messages/{es,en}.json`, actions y validaciones
  traducidas, selector de idioma (`/configuracion/idioma`).
- Migración FASE 1 **aplicada** en producción (`efgmjuzcqolpibraymol`) el 2026-08-03:
  `supabase/migrations/20260803000000_fase1_profiles_extended.sql`. `migration list`:
  local = remoto = `20260731000000` y `20260803000000`.
- `src/types/database.types.ts` **regenerado** con `npm run supabase:types` (esquema `public`
  con 13 tablas: las 4 originales + `professional_roles`, `profile_languages`,
  `profile_experience`, `profile_education`, `profile_links`, `profile_achievements`,
  `profile_preferences`, `profile_blocks`, `profile_follows`). El esquema `graphql_public`
  ya no se exporta (no lo usa el código; el script usa `--schema public`).
- `profiles` añade `contact_email` y `timezone` (nullable, con CHECK).
- RLS: activado en las 9 tablas nuevas. Políticas: `*_select_public` (lectura solo si el
  perfil es público), `*_select_own`/`*_insert_own`/`*_update_own`/`*_delete_own`
  (propietario), `profile_follows_select_followers` (ver seguidores), y en
  `professional_roles` lectura pública. `profile_blocks`/`profile_follows` no conceden
  SELECT anónimo.
- Ajuste de script: `supabase:db:push` pasó de `--project-ref` (flag eliminado en la CLI
  2.110.0) a `--linked`.
- Riesgo `user_types` (sección 6): resuelto con el catálogo `professional_roles`.

### Verificación de proyectos Supabase (2026-08-03)

- La cuenta tiene 2 proyectos: `efgmjuzcqolpibraymol` ("pau159dalo36-prog's Project") y
  `raqcchcvypeptywpjisn` ("portal-emprendimiento", **vacío**: sin tablas ni migraciones).
- La CLI llegó a enlazarse temporalmente a `raqcchcvypeptywpjisn`; se verificó que ese
  proyecto no tiene esquema (`gen types --linked` solo muestra la función `graphql`).
- Confirmado con el usuario: producción y local usan **`efgmjuzcqolpibraymol`**. La CLI se
  relinkó de vuelta; `supabase/.temp/project-ref` = `efgmjuzcqolpibraymol` y
  `migration list` vuelve a mostrar local = remoto = `20260731000000`.
- `.env.local` apunta correctamente a `https://efgmjuzcqolpibraymol.supabase.co`.
