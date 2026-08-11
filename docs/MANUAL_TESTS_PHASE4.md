# Manual de pruebas — FASE 4 (posts, follows, analytics y feed)

Prerequisitos: migraciones hasta `20260814000000_fase4_4_feed.sql` aplicadas en
remoto (13/13), tipos regenerados (`npm run supabase:types`), `npm run check`
en verde. Los tests SQL `supabase/tests/fase4_*.sql` requieren stack local
(Docker) y NO deben ejecutarse contra producción; esta guía cubre la
verificación manual/read-only.

## 1. Feed "Para ti" (homepage `/`)

- [ ] Sin sesión: la homepage muestra la pestaña "Para ti" con los posts
      públicos (vídeos `published` + `ready` + distribuibles).
- [ ] Un vídeo `rejected`/`flagged` NO aparece en el feed.
- [ ] Un vídeo `unlisted`/`private`/`registered_users`/`project_members` NO
      aparece para anónimos.
- [ ] "Siguiendo" sin sesión muestra la CTA de iniciar sesión (no llama a la RPC).
- [ ] Con sesión: "Para ti" conserva el mismo contenido; "Siguiendo" sin follows
      muestra "No sigues a nadie" con CTA Explorar.
- [ ] "Cargar más" página 2+: sin duplicados ni solapamiento; el botón se oculta
      cuando no hay más páginas.
- [ ] Reintentar tras un error inicial conserva la pestaña y no rompe la UI.
- [ ] Cada tarjeta: miniatura (o fallback con icono), título, autor/avatar,
      proyecto/organización y vistas cualificadas (> 0).

## 2. Feed "Siguiendo"

- [ ] Seguir a un perfil/proyecto/organización con contenido publicado hace que
      sus posts aparezcan en "Siguiendo" (cronológico).
- [ ] Si un post coincide por varios seguidos a la vez, aparece UNA sola vez.
- [ ] Al dejar de seguir, el post desaparece de "Siguiendo" en la siguiente carga.
- [ ] La pestaña "Siguiendo" no reordena por afinidad (sigue el orden cronológico).

## 3. Follows y bloqueos (páginas públicas)

- [ ] `/perfil/[username]`, `/proyectos/[slug]` y `/organizaciones/[slug]`
      muestran contadores de seguidores/seguidos.
- [ ] El botón Seguir/Dejar de seguir funciona y no recarga la página
      (useActionState), con estado pendiente deshabilitado.
- [ ] No puedes seguirte a ti mismo (error/validación).
- [ ] A bloquea a B → B no aparece en los follows de A ni viceversa; B no puede
      volver a seguir a A mientras dure el bloqueo; al desbloquear no se
      recrean follows automáticamente.
- [ ] Los posts de un usuario que te ha bloqueado NO aparecen en tu "Para ti".
- [ ] Anónimo no puede seguir (requiere sesión).

## 4. Analytics (player y métricas)

- [ ] En `/videos/[id]` público: el player envía watch time; el contador de
      vistas cualificadas aparece solo en vídeos distribuibles.
- [ ] En `/panel/videos`: cada vídeo muestra vistas cualificadas, tiempo medio
      y % completado (o "Sin datos todavía" sin vistas).
- [ ] Reproducir < 3 s NO cualifica vista; ≥ 3 s sí (idempotente: repetir no
      duplica).
- [ ] Un seek al final sin tiempo real NO marca completion ni infla watch time.
- [ ] La sesión anónima no mezcla métricas entre usuarios.

## 5. Integración posts ↔ vídeos

- [ ] Publicar un vídeo crea exactamente UN post (re-publicar no duplica).
- [ ] Retirar/archivar el vídeo retira su post del feed; re-publicar lo restaura.
- [ ] Borrar el vídeo borra su post en cascada.
- [ ] La moderación `rejected`/`flagged` retira el post del feed al instante;
      `approved` lo restaura.

## 6. Checks finales

- [ ] `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build`.
- [ ] `npx supabase db push --dry-run` → "Remote database is up to date."
- [ ] Rutas `/es` y `/en` simétricas (i18n sin claves solo en un idioma).
