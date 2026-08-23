-- ============================================================================
-- FASE 9 — ENDURECIMIENTO DE PRIVILEGIOS MÍNIMOS (ACL AUDIT)
-- ============================================================================
--
-- Re-auditoría idempotente de la ACL introducida en fase 9. Supabase concede
-- privilegios por defecto a anon/authenticated sobre cada tabla nueva, así que
-- esta migración revoca primero y vuelve a conceder SOLO lo mínimo, sin
-- depender de default privileges:
--
--   post_comments            anon: select | authenticated: select,insert,update,delete
--   project_feedback         authenticated: select,insert,update,delete (sin anon)
--   post_reactions           authenticated: select,insert,delete (sin anon)
--   saved_posts/projects/opportunities authenticated: select,insert,delete (sin anon)
--   interaction_events       SIN privilegios para anon/authenticated (outbox)
--
-- Funciones: EXECUTE mínimo (helpers de bloqueo/visibilidad solo
-- authenticated; RPCs de conteo también anon); las funciones internas de
-- triggers sin concesión alguna (fail-closed).
-- ============================================================================

begin;

-- --- Tablas: revocar todo y re-conceder lo mínimo ---------------------------

revoke all privileges on table public.post_comments from public;
revoke all privileges on table public.post_comments from anon;
revoke all privileges on table public.post_comments from authenticated;
grant select on table public.post_comments to anon;
grant select, insert, update, delete on table public.post_comments to authenticated;

revoke all privileges on table public.project_feedback from public;
revoke all privileges on table public.project_feedback from anon;
revoke all privileges on table public.project_feedback from authenticated;
grant select, insert, update, delete on table public.project_feedback to authenticated;

revoke all privileges on table public.post_reactions from public;
revoke all privileges on table public.post_reactions from anon;
revoke all privileges on table public.post_reactions from authenticated;
grant select, insert, delete on table public.post_reactions to authenticated;

revoke all privileges on table public.saved_posts from public;
revoke all privileges on table public.saved_posts from anon;
revoke all privileges on table public.saved_posts from authenticated;
grant select, insert, delete on table public.saved_posts to authenticated;

revoke all privileges on table public.saved_projects from public;
revoke all privileges on table public.saved_projects from anon;
revoke all privileges on table public.saved_projects from authenticated;
grant select, insert, delete on table public.saved_projects to authenticated;

revoke all privileges on table public.saved_opportunities from public;
revoke all privileges on table public.saved_opportunities from anon;
revoke all privileges on table public.saved_opportunities from authenticated;
grant select, insert, delete on table public.saved_opportunities to authenticated;

revoke all privileges on table public.interaction_events from public;
revoke all privileges on table public.interaction_events from anon;
revoke all privileges on table public.interaction_events from authenticated;
-- service_role conserva sus privilegios por defecto: es el único consumidor
-- previsto del outbox (FASE 10). No se conceden privilegios nuevos aquí.

-- --- Funciones públicas: revoke-first + grant explícito ---------------------

-- Helpers de bloqueo/visibilidad: SOLO authenticated (las políticas de
-- escritura los invocan con privilegios del llamador). anon sin EXECUTE.
revoke execute on function public.profiles_can_interact(uuid, uuid) from public;
revoke execute on function public.profiles_can_interact(uuid, uuid) from anon;
revoke execute on function public.profiles_can_interact(uuid, uuid) from authenticated;
grant execute on function public.profiles_can_interact(uuid, uuid) to authenticated;

revoke execute on function public.project_is_publicly_visible(uuid) from public;
revoke execute on function public.project_is_publicly_visible(uuid) from anon;
revoke execute on function public.project_is_publicly_visible(uuid) from authenticated;
grant execute on function public.project_is_publicly_visible(uuid) to authenticated;

revoke execute on function public.toggle_post_support(uuid) from public;
revoke execute on function public.toggle_post_support(uuid) from anon;
revoke execute on function public.toggle_post_support(uuid) from authenticated;
grant execute on function public.toggle_post_support(uuid) to authenticated;

revoke execute on function public.get_post_interaction_counts(uuid[]) from public;
revoke execute on function public.get_post_interaction_counts(uuid[]) from anon;
revoke execute on function public.get_post_interaction_counts(uuid[]) from authenticated;
grant execute on function public.get_post_interaction_counts(uuid[]) to anon, authenticated;

revoke execute on function public.get_project_feedback_count(uuid) from public;
revoke execute on function public.get_project_feedback_count(uuid) from anon;
revoke execute on function public.get_project_feedback_count(uuid) from authenticated;
grant execute on function public.get_project_feedback_count(uuid) to anon, authenticated;

-- --- Funciones internas (triggers): fail-closed -----------------------------

revoke all privileges on function public.post_comments_validate_thread() from public, anon, authenticated;
revoke all privileges on function public.post_comments_guard_update() from public, anon, authenticated;
revoke all privileges on function public.project_feedback_guard_update() from public, anon, authenticated;
revoke all privileges on function public.interaction_event_comment() from public, anon, authenticated;
revoke all privileges on function public.interaction_event_feedback() from public, anon, authenticated;
revoke all privileges on function public.interaction_event_reaction() from public, anon, authenticated;

commit;
