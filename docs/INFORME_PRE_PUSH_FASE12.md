# Informe pre-push — FASE 12 (Seguridad, moderación y privacidad)

> Documento de 53 puntos entregado ANTES de autorizar el push como checklist de
> revisión. **Ejecutado y verificado tras el push** del 2026-08-29: las
> migraciones FASE 12 (`20260826000000` + fix `20260829000000`) están aplicadas
> en remoto, la auditoría post-push está en verde y hay commit único +
> `git push origin main`. Los puntos 9/15/22/25 se corrigieron con los datos
> reales de la auditoría.

## A. Alcance y estado del push

1. Todo el trabajo de FASE 12 está implementado localmente y verificado; queda
   **una única migración pendiente**: `20260826000000_fase12_security_hardening.sql`.
2. El remoto (`efgmjuzcqolpibraymol`) está en 25/25; `supabase db push
   --dry-run --linked` reporta "Would push these migrations:
   20260826000000_fase12_security_hardening.sql" (solo esa, sin ejecutar nada).
3. No se ha realizado push real, no hay commit nuevo y no se ha tocado el
   proyecto `raqcchcvypeptywpjisn`.
4. No se han editado migraciones históricas ni se ha regenerado `database.types`
   todavía (se hará tras el push, como en fases anteriores).
5. Los bloques de la migración son idempotentes en estructura (guards CREATE/
   REVOKE/GRANT); las correcciones futuras irán en migraciones nuevas, no
   reescribiendo esta.
6. Para revertir parcialmente (column grants / REVOKE de EXECUTE) se necesita
   re-GRANT manual; ya documentado como nota en `docs/DATABASE.md`/`SECURITY.md`.

## B. ACL revoke-first + hardening de `profiles`

7. Se revoca el grant SELECT de plataforma sobre `profiles` a `public`
   (default de Supabase) y se re-concede lo estrictamente necesario.
8. La reconcesión mantiene el modelo RLS existente: SELECT según políticas,
   INSERT/UPDATE propios vía `auth.uid()`, sin DELETE/TRUNCATE/resetgrant de
   plataforma a `public`.
9. REVOKE de EXECUTE a `public` de las **19 funciones de trigger/helper** de
   FASE 1/4 (verificadas contra el catálogo `pg_proc` y contra el remoto real:
   `has_function_privilege` false para anon/authenticated en las 19).
10. Incluye las 5 señaladas como hardening pendiente en FASE 7:
    `normalize_slug`, `handle_updated_at`, `prevent_id_change`,
    `organizations_add_owner_member`, `projects_add_owner_member`.
11. No es una vulnerabilidad activa en PostgreSQL (los triggers se ejecutan
    independientemente del grant), pero cierra la superficie de PostgREST, que
    expondría esas funciones como endpoints si quedaran ejecutables.
12. Se conservan los EXECUTE requeridos por columnas generadas (p. ej.
    `search_normalize` al escribir) y por las RLS, igual que en FASE 5/6/7.
13. Las RPCs y grants de FASE 4.2–FASE 10 no se tocan: todo lo que sus LLS
    invocan con privilegios del llamador sigue concedido.
14. El resto de tablas (posts/videos/etc.) mantienen su ACL intacta; esta
    migración solo blindó `profiles` y el catálogo de funciones.

## C. Column grants de `profiles` + `get_own_profile()`

15. `contact_email`, `timezone`, `search_text` y `onboarding_completed` dejan de
    ser SELECT públicas (probado como anon: `permission denied`); los datos de
    sesión siguen viniendo de `supabase.auth`, no de la tabla.
16. El resto de columnas (username, avatar, bio, etc.) SÍ permanecen legibles
    (necesarias para perfiles públicos y búsquedas).
17. **El generador de tipos NO emite column grants**: la frontera se mantiene a
    mano en `src/types/database.types.ts` (nota documentada en PROGRESS).
18. `get_own_profile()` (SECURITY DEFINER, `search_path=''`, `auth.uid()`
    interno) devuelve la fila completa del usuario incluso si su perfil es
    privado; fail-closed sin sesión.
19. Todos los puntos de lectura propia migraron: destino post-login, perfil
    propio, panel, onboarding y `configuracion/perfil`.
20. El perfil público usa columnas explícitas (se verificó con un usuario real
    que ya no se filtraba `email` en el payload).

## D. Bloqueos bidireccionales en el buscador

21. `search_projects`, `search_organizations`, `search_videos` y
    `search_opportunities` ahora excluyen en AMBOS sentidos: quien bloquea al
    lector y a quien el lector bloquea.
22. Implementación con `NOT EXISTS` sobre `profile_blocks` en ambos sentidos
    (antes solo cubría el bloqueo del autor hacia el lector).
23. Mantienen el patrón fail-closed de FASE 5/6/7 (SECURITY DEFINER,
    `search_path=''`, auth.uid() interno) y firmas públicas incompatibles con
    `src/search` y `src/opportunities`.
24. La exclusión se aplica sobre el resultado ordenado del cursor (sin sesgo de
    ranking), cobertura verificable por `pg_get_functiondef` en la auditoría.

## E. `content_reports` + moderación admin

25. `content_reports` con targets tipados (posts, videos, projects,
    opportunities, services, organization, comment, profile) y payload acotado
    por CHECK (target_type/reason/status).
26. PK compuesta (reporter, target_type, target_id): una denuncia por medio y
    destino; re-denuncia solo si sigue pendiente.
27. Estado/resolución: `pending|reviewed` con resolución `ignore`/
    `mark_as_approved`/`remove` (sin DELETE: semántica de auditoría).
28. Mensaje entre 8 y 600 caracteres tras `btrim`; self-report del propio
    contenido denegado por el flujo de UI/action.
29. `admin_resolve_report` SECURITY DEFINER fail-closed con
    `is_platform_admin()` interno y códigos 0/1/2 (no encontrado / resuelto /
    ya resuelto).
30. `remove` en `admin_resolve_report` solo marca resolución; el borrado
    físico se hace desde la action de moderación (mecánica completa descrita en
    la página `/admin/reportes`).
31. Gate con `requireAdmin()` en `admin/layout.tsx` cubre TODAS las rutas
    `/admin/*` (server-side, fail-closed).
32. UI: botón de denuncia en vídeos / servicios / oportunidades, página
    `/admin/reportes` con listado y resolución; i18n ES/EN paritaria.
33. `src/actions/reports.ts` valida entrada con Zod y aplica rate-limit
    report 5/h.

## F. Rate limits

34. `rate_limits` sin grants directos: solo la RPC escribe/lee
    (mínimo privilegio; tabla opaca a anon/authenticated).
35. `consume_rate_limit(p_scope, p_scope_key, p_max, p_window_seconds)` es
    SECURITY DEFINER, atómica (INSERT ON CONFLICT + ventana) y fail-closed,
    devuelve boolean; PL/pgSQL corregido (`returning counter into v_counter`).
36. PK compuesta (scope, scope_key, window_start) + borrado oportunista de
    expirados, sin cron.
37. Scopes activos: sign_up 5/h, sign_in 10/min, password_reset 5/h,
    update_password 5/h, follow 120/min, comment 30/min, support 60/min,
    avatar 6/min, report 5/h.
38. Los scopes de auth usan clave anónima por IP individual
    (`getAnonymousRateLimitKey`: primer valor de `x-forwarded-for`, o `anon`);
    los scopes con sesión usan `user.id` (no IP) para evitar colisiones NAT.
39. `password_reset` responde éxito aunque se haya alcanzado el límite
    (anti-enumeración de cuentas), consumiendo límite real·por clave anónima.
40. `toggleSaveAction` queda sin rate-limit (decisión deliberada: operación
    idempotente por usuario).

## G. Capa de aplicación / frontend

41. `src/lib/rate-limit.ts` nuevo (helper compartido, tipado con la RPC).
42. `getPostLoginDestination` ya no recibe `userId`; callers actualizados
    (auth.ts ×2 y callback route) — se eliminó el perfil propio del destino.
43. Gate `can_manage_opportunity` en `/panel/oportunidades/[id]/candidatos`
    (solo managers/admin) — cierre del fallo de autorización de FASE 8.
44. Mime de vídeo por lista cerrada y `resolvePlaybackUrl` devuelve `null`
    (no URLs inventadas); bounds Zod de arrays producto y niveles con
    `MAX_SKILLS=8`.
45. Páginas legales `/[locale]/legal/{terminos,privacidad}` + enlaces rich
    text en el registro y en el footer del layout auth; textos son borradores.
46. `sign-up-form.tsx` exige aceptar términos/privacidad con enlaces antes de
    enviar; `signedIn` no se ve afectado.

## H. Headers de seguridad y dependencias

47. `next.config.ts`: `poweredByHeader:false` + `headers()` globals (`/` y
    `/:path*`) con X-DNS-Prefetch-Control, HSTS 2 años, X-Frame-Options
    SAMEORIGIN, nosniff, Referrer-Policy strict-origin-when-cross-origin,
    Permissions-Policy (camera/mic/geolocation/topics) y CSP base con
    `frame-ancestors 'self'` y `form-action 'self'`.
48. `netlify.toml` espeja los mismos headers para el deploy en Netlify
    (mismas directivas).
49. Upgrade `next` 16.2.12 → 16.3.3 y `eslint-config-next` alineado: elimina
    las 3 vulnerabilidades high de producción (postcss ≤8.5.22, sharp <0.35.0).
50. `npm audit --omit=dev` → **0 vulnerabilidades**; las 5 high restantes son
    dev-only del chain netlify-cli y requieren un downgrade breaking
    (documentado, no forzado).
51. `SUPABASE_SECRET_KEY` vive SOLO en `.env.local` (gitignored; uso exclusivo
    del script de admin dev); al navegador solo llegan valores `NEXT_PUBLIC_*`.

## I. Tests y verificación

52. `npm run lint`, `typecheck`, `build` en verde; `npm run test`
    **501/501** (49 ficheros): `rate-limit.test.ts`, `reports.test.ts`,
    rate-limit en `interactions.test.ts`, mocks `@/lib/rate-limit` en
    `auth.test.ts`/`interactions.test.ts`; el test SQL transaccional
    `supabase/tests/fase12_security_hardening.sql` (rollback) requiere stack
    local.

## J. Pendientes

53. Pendientes: aplicar `db push` + regenerar tipos + auditoría read-only/
    conductual post-push, ejecutar el test SQL local, revisar los textos
    legales con el responsable, y **autorización explícita del usuario para el
    push y el commit/push de la FASE 12** (este informe se entrega para
    decidirlo).