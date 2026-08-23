-- ============================================================================
-- FASE 6 (corrección) — Mínimo privilegio en tabla y funciones de oportunidades
-- ============================================================================
-- Objetivo: revocar los grants directos que los default privileges de Supabase
-- concedieron a `anon` y `authenticated` al crearse la tabla `opportunities`
-- y sus funciones de trigger. El revoke sobre `public` de la migración original
-- (20260817000000) no toca esos grants directos, igual que ocurrió en FASE 4.2
-- (follows) y FASE 4.3 (analytics).
--
-- Modelo de acceso (invariante de mínimo privilegio):
--   - opportunities: SELECT para anon (solo distribuible público vía RLS) y
--     SELECT/INSERT/UPDATE para authenticated. SIN DELETE (el ciclo de vida se
--     gestiona por estados draft/published/closed/filled/cancelled, nunca por
--     borrado directo) ni TRUNCATE/REFERENCES/TRIGGER para nadie.
--   - Funciones de trigger (opportunities_validate_state_change,
--     posts_sync_from_opportunity): sin EXECUTE externo; se ejecutan como
--     triggers (PostgreSQL no comprueba EXECUTE al dispararse) y una invocación
--     directa fuera de contexto falla de todos modos sin efectos.
--
-- La RLS permanece habilitada (fail-closed) como segunda barrera.

begin;

-- Tabla: anon solo lectura pública (RLS decide qué filas).
revoke insert on public.opportunities from anon;
revoke update on public.opportunities from anon;
revoke delete on public.opportunities from anon;
revoke truncate on public.opportunities from anon;
revoke references on public.opportunities from anon;
revoke trigger on public.opportunities from anon;

-- Tabla: authenticated gestiona (select/insert/update, ya concedidos); nada de
-- borrado directo ni privilegios auxiliares.
revoke delete on public.opportunities from authenticated;
revoke truncate on public.opportunities from authenticated;
revoke references on public.opportunities from authenticated;
revoke trigger on public.opportunities from authenticated;

-- Reafirmación idempotente del estado deseado.
grant select on public.opportunities to anon, authenticated;
grant select, insert, update on public.opportunities to authenticated;

-- Funciones de trigger: sin EXECUTE externo.
revoke execute on function public.opportunities_validate_state_change() from anon;
revoke execute on function public.opportunities_validate_state_change() from authenticated;
revoke execute on function public.posts_sync_from_opportunity() from anon;
revoke execute on function public.posts_sync_from_opportunity() from authenticated;

commit;
