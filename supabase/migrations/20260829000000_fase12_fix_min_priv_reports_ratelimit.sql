-- ============================================================================
-- FASE 12 (fix) — Mínimo privilegio de content_reports y rate_limits
-- ============================================================================
-- Detectado en la auditoría post-push contra el remoto real: al crear las
-- tablas content_reports y rate_limits dentro de la migración FASE 12, los
-- default privileges de la plataforma concedieron TODOS los privilegios
-- (DELETE/INSERT/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE) a anon y
-- authenticated, porque esas dos tablas no pasaron por el revoke-first de la
-- sección 1. La RLS las protege (deny-all en rate_limits; policies propias en
-- content_reports), pero el grant viola el principio de mínimo privilegio.
--
-- Corrección revoke-first idempotente:
--   * content_reports: anon NADA; authenticated select/insert/update (se usa
--     via server actions, patrón FASE 9).
--   * rate_limits: anon y authenticated NADA (solo la RPC SECURITY DEFINER
--     consume_rate_limit accede como owner).
-- ============================================================================

revoke all privileges on table public.content_reports from public;
revoke all privileges on table public.content_reports from anon;
revoke all privileges on table public.content_reports from authenticated;
grant select, insert, update on table public.content_reports to authenticated;

revoke all privileges on table public.rate_limits from public;
revoke all privileges on table public.rate_limits from anon;
revoke all privileges on table public.rate_limits from authenticated;