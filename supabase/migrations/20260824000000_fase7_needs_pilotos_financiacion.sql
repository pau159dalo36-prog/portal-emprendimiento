-- ============================================================================
-- FASE 7 — Señales del proyecto: primeros usuarios, mentoría e inversión
-- ============================================================================
-- Migración NO destructiva. Soporta tres señales MVP sobre proyectos:
--
--   A) PILOT USERS ("busco primeros usuarios / testers"):
--      public.project_pilot_plans, tabla NUEVA y dedicada 1:1 con el proyecto.
--      NO se mete en `project_needs` porque sus campos son propios
--      (qué probar, perfil de tester, qué espera, incentivo, plazas) y no enca
--      en el modelo genérico de necesidades. Sin sistema de testing complejo:
--      solo la declaración pública + CTA de mensaje (FASE 10).
--
--   B) MENTOR / EXPERTO ("busco mentor"): se EXTIENDE `project_needs` con la
--      columna need_kind ∈ member | mentor | tester (default 'member',
--      retrocompatible: todas las filas existentes pasan a ser 'member').
--      Reutiliza title/description/skill_id/commitment tal cual; sin
--      marketplace de mentoría separado. Las necesidades 'tester' permiten
--      declarar además una necesidad simple de testers sin plan completo.
--
--   C) SEÑAL DE INVERSIÓN ("busco inversión"): columnas nuevas en `projects`.
--      Es un atributo del proyecto, no una "necesidad": seeking_investment +
--      funding_stage + amount_sought + currency + investment_note. SOLO señal
--      informativa: sin transacciones, sin equity exchange, sin pagos ni docs
--      legales. Si seeking_investment = false los campos van a NULL (CHECK).
--
-- Seguridad: RLS espejo de project_needs (público si el proyecto es público y
-- publicado; gestión por miembros); ACL revoke-first para lo nuevo. Las
-- columnas nuevas de `projects` y `project_needs` quedan cubiertas por los
-- grants de tabla ya existentes (select/insert/update).
-- ============================================================================

begin;

-- ============================================================================
-- 1. Señal de inversión en `projects`
-- ============================================================================
alter table public.projects
  add column if not exists seeking_investment boolean not null default false;

alter table public.projects
  add column if not exists funding_stage text;

alter table public.projects
  add column if not exists amount_sought numeric;

alter table public.projects
  add column if not exists investment_currency text;

alter table public.projects
  add column if not exists investment_note text;

-- Coherencia de la señal: sin búsqueda activa todo va a NULL; con búsqueda,
-- stage/amount/moneda/nota son opcionales (señal mínima = flag).
alter table public.projects
  drop constraint if exists projects_funding_signal_check;
alter table public.projects
  add constraint projects_funding_signal_check check (
    (
      seeking_investment = false
      and funding_stage is null
      and amount_sought is null
      and investment_currency is null
      and investment_note is null
    )
    or seeking_investment = true
  );

alter table public.projects
  drop constraint if exists projects_funding_stage_check;
alter table public.projects
  add constraint projects_funding_stage_check check (
    funding_stage is null
      or funding_stage in ('idea', 'pre_seed', 'seed', 'series_a', 'growth')
  );

alter table public.projects
  drop constraint if exists projects_amount_sought_check;
alter table public.projects
  add constraint projects_amount_sought_check check (
    amount_sought is null or amount_sought >= 0
  );

alter table public.projects
  drop constraint if exists projects_investment_currency_check;
alter table public.projects
  add constraint projects_investment_currency_check check (
    investment_currency is null or investment_currency ~ '^[A-Z]{3}$'
  );

alter table public.projects
  drop constraint if exists projects_investment_note_length_check;
alter table public.projects
  add constraint projects_investment_note_length_check check (
    investment_note is null or length(investment_note) <= 2000
  );

create index if not exists projects_seeking_investment_idx
  on public.projects (seeking_investment)
  where seeking_investment = true;

-- ============================================================================
-- 2. Tipo de necesidad en `project_needs` (mentor / tester)
-- ============================================================================
alter table public.project_needs
  add column if not exists need_kind text not null default 'member';

alter table public.project_needs
  drop constraint if exists project_needs_need_kind_check;
alter table public.project_needs
  add constraint project_needs_need_kind_check check (
    need_kind in ('member', 'mentor', 'tester')
  );

create index if not exists project_needs_need_kind_idx
  on public.project_needs (need_kind);

-- ============================================================================
-- 3. Plan de primeros usuarios (pilot users), 1:1 con el proyecto
-- ============================================================================
create table if not exists public.project_pilot_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  what_to_test text not null,
  target_user_profile text,
  tester_expectations text,
  incentive_note text,
  slots_total integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_pilot_plans_what_to_test_length check (
    length(btrim(what_to_test)) between 10 and 1000
  ),
  constraint project_pilot_plans_target_profile_length check (
    target_user_profile is null or length(target_user_profile) <= 500
  ),
  constraint project_pilot_plans_expectations_length check (
    tester_expectations is null or length(tester_expectations) <= 1000
  ),
  constraint project_pilot_plans_incentive_length check (
    incentive_note is null or length(incentive_note) <= 300
  ),
  constraint project_pilot_plans_slots_check check (
    slots_total is null or slots_total > 0
  )
);

drop trigger if exists project_pilot_plans_set_updated_at on public.project_pilot_plans;
create trigger project_pilot_plans_set_updated_at
  before update on public.project_pilot_plans
  for each row execute function public.handle_updated_at();

drop trigger if exists project_pilot_plans_prevent_id_change on public.project_pilot_plans;
create trigger project_pilot_plans_prevent_id_change
  before update on public.project_pilot_plans
  for each row execute function public.prevent_id_change();

-- El plan nunca cambia de proyecto.
create or replace function public.project_pilot_plans_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception 'PROJECT_PILOT_PLAN_IMMUTABLE_PROJECT';
  end if;
  return new;
end;
$$;

drop trigger if exists project_pilot_plans_guard_update_trigger on public.project_pilot_plans;
create trigger project_pilot_plans_guard_update_trigger
  before update on public.project_pilot_plans
  for each row execute function public.project_pilot_plans_guard_update();

revoke all privileges on function public.project_pilot_plans_guard_update()
  from public, anon, authenticated;

-- RLS: espejo de project_needs — público si el proyecto es público y
-- publicado; gestión por miembros reales del proyecto.
alter table public.project_pilot_plans enable row level security;

drop policy if exists "project_pilot_plans_select_public" on public.project_pilot_plans;
create policy "project_pilot_plans_select_public"
  on public.project_pilot_plans for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id and is_public = true and status = 'published'
    )
  );

drop policy if exists "project_pilot_plans_select_own" on public.project_pilot_plans;
create policy "project_pilot_plans_select_own"
  on public.project_pilot_plans for select
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
  );

drop policy if exists "project_pilot_plans_select_member" on public.project_pilot_plans;
create policy "project_pilot_plans_select_member"
  on public.project_pilot_plans for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "project_pilot_plans_insert_manage" on public.project_pilot_plans;
create policy "project_pilot_plans_insert_manage"
  on public.project_pilot_plans for insert
  to authenticated
  with check (public.is_project_member(project_id));

drop policy if exists "project_pilot_plans_update_manage" on public.project_pilot_plans;
create policy "project_pilot_plans_update_manage"
  on public.project_pilot_plans for update
  to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "project_pilot_plans_delete_manage" on public.project_pilot_plans;
create policy "project_pilot_plans_delete_manage"
  on public.project_pilot_plans for delete
  to authenticated
  using (public.is_project_member(project_id));

-- ACL revoke-first: lectura pública del plan de proyectos públicos; gestión
-- solo authenticated (RLS limita a miembros).
revoke all privileges on table public.project_pilot_plans from anon;
revoke all privileges on table public.project_pilot_plans from authenticated;
grant select on public.project_pilot_plans to anon, authenticated;
grant select, insert, update, delete on public.project_pilot_plans to authenticated;

commit;
