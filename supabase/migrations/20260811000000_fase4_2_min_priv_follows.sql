-- FASE 4.2 (corrección) — Mínimo privilegio en tablas de follows
-- ============================================================================
-- Objetivo: revocar a `anon` el SELECT directo sobre las tablas de follows
-- (heredado del auto-expose de PostgREST al crearse las tablas). La RLS ya
-- devolvía 0 filas a anon (fail-closed), pero por mínimo privilegio se elimina
-- el grant de lectura.
--
-- Los contadores públicos siguen servidos por las RPC
-- count_*_followers/following (SECURITY DEFINER con EXECUTE concedido a anon y
-- authenticated): un anónimo obtiene SOLO bigint agregados, nunca IDs.
--
-- Se mantiene SELECT para `authenticated`, necesario para las lecturas RLS de
-- getFollowedProfileIds / getFollowedProjectIds / getFollowedOrganizationIds
-- y para las políticas insert_own/delete_own.

begin;

revoke select on public.profile_follows from anon;
revoke select on public.project_follows from anon;
revoke select on public.organization_follows from anon;

-- Idempotente: garantiza el estado deseado para authenticated (ya concedido en
-- FASE 1 / FASE 4.2).
grant select on public.profile_follows to authenticated;
grant select on public.project_follows to authenticated;
grant select on public.organization_follows to authenticated;

commit;
