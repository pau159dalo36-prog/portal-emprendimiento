-- FASE 4.3 (corrección) — Mínimo privilegio en tabla y funciones de analytics
-- ============================================================================
-- Objetivo: revocar los grants directos que el auto-expose de PostgREST
-- concedió a `anon` y `authenticated` al crearse la tabla video_view_sessions
-- y sus funciones. El revoke sobre `public` de la migración original no toca
-- esos grants directos, igual que ocurrió en FASE 4.2 con las tablas de
-- follows.
--
-- Modelo de acceso (invariante de mínimo privilegio):
--   - video_view_sessions: SIN acceso directo para anon/authenticated. Solo la
--     lee el definer (postgres) dentro de las RPC SECURITY DEFINER.
--   - video_analytics_access / _video_metrics_aggregate: SIN EXECUTE externo
--     (funciones internas de la suite, solo se invocan dentro de otras RPC).
--   - report_video_view: EXECUTE para anon y authenticated (escritura de
--     vistas por el cliente; segura y rate-limited).
--   - get_public_video_views_count: EXECUTE para anon y authenticated (agregado
--     público).
--   - get_video_metrics / get_post_metrics: EXECUTE SOLO para authenticated.
--
-- La RLS permanece habilitada (fail-closed) como segunda barrera.

begin;

-- Tabla privada: sin acceso directo para los roles de cliente.
revoke all on public.video_view_sessions from anon;
revoke all on public.video_view_sessions from authenticated;

-- Funciones internas: sin EXECUTE externo.
revoke execute on function public.video_analytics_access(uuid) from anon;
revoke execute on function public.video_analytics_access(uuid) from authenticated;
revoke execute on function public._video_metrics_aggregate(uuid) from anon;
revoke execute on function public._video_metrics_aggregate(uuid) from authenticated;

-- get_video_metrics / get_post_metrics: solo authenticated (datos de
-- moderación y analítica no pública).
revoke execute on function public.get_video_metrics(uuid) from anon;
revoke execute on function public.get_post_metrics(uuid) from anon;

-- Reafirmación idempotente del estado deseado.
grant execute on function public.report_video_view(uuid, text, numeric, numeric) to anon, authenticated;
grant execute on function public.get_public_video_views_count(uuid) to anon, authenticated;
grant execute on function public.get_video_metrics(uuid) to authenticated;
grant execute on function public.get_post_metrics(uuid) to authenticated;

commit;
