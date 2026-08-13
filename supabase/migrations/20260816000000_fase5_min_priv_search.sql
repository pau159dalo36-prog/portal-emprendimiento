-- ============================================================================
-- FASE 5 — Corrección de mínimo privilegio: search_recency no se expone
-- ============================================================================
-- Al crear search_recency, los default privileges de Supabase concedieron
-- EXECUTE a anon/authenticated. La migración principal (20260815000000) solo
-- revocó de PUBLIC, así que la función quedó expuesta por PostgREST.
--
-- search_recency solo debe correr DENTRO de las RPC SECURITY DEFINER (con los
-- privilegios de postgres). Se revoca de anon/authenticated: es una función
-- pura de matemáticas sin datos, pero el diseño la mantiene fail-closed y
-- fuera del alcance de anon/authenticated (nada que ver, nada que explorar).
revoke execute on function public.search_recency(timestamptz, timestamptz) from public;
revoke execute on function public.search_recency(timestamptz, timestamptz) from anon;
revoke execute on function public.search_recency(timestamptz, timestamptz) from authenticated;
