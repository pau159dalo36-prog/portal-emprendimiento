-- Correctivo aditivo: restringe `videos_select_admin` a `authenticated`
-- ============================================================================
-- Contexto:
--  * La política `videos_select_admin` (creada en 20260806010000) es `for select`
--    SIN cláusula `to`, por lo que Postgres la evalúa para TODOS los roles,
--    incluido `anon`. Su USING llama a `public.is_platform_admin()`, cuyo EXECUTE
--    FASE 3 revoca a `public`/`anon` y concede SOLO a `authenticated`. Como RLS
--    OR-ea todas las políticas aplicables, cualquier SELECT de `videos` como
--    `anon` terminaba con "permission denied for function is_platform_admin"
--    (401 en PostgREST): el listado público de vídeos quedaba siempre vacío.
--  * Un administrador de plataforma siempre es un usuario autenticado: la
--    política solo necesita evaluarse para `authenticated`. Restringirla con
--    `to authenticated` elimina el error para `anon` sin cambiar nada de
--    comportamiento y sin ampliar los grants de la función (mínimo privilegio).
--  * Solo se sustituye esa política (drop if exists + create), mismo patrón
--    aditivo que 20260806000000_fix_videos_public_read.sql. No toca tablas,
--    buckets, funciones ni otras políticas.

begin;

drop policy if exists "videos_select_admin" on public.videos;

create policy "videos_select_admin"
  on public.videos for select
  to authenticated
  using (public.is_platform_admin());

commit;
