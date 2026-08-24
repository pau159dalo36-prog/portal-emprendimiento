-- ============================================================================
-- FASE 8 — CANDIDATURAS A OPORTUNIDADES (migración NO destructiva)
-- ============================================================================
--
-- MVP de candidaturas sobre `opportunities` (fase 6) y el outbox de la
-- fase 9:
--
--   public.applications   Una candidatura por persona y oportunidad
--                         (UNIQUE(opportunity_id, applicant_id)).
--
-- Decisiones de diseño:
--
--   * Estados MVP: submitted → viewed → accepted|rejected, y
--     submitted|viewed → withdrawn (solo el applicant). accepted/rejected/
--     withdrawn son TERMINALES: no vuelven a estados previos. No hay pipeline.
--
--   * Elegibilidad (predicado canónico reutilizado, sin semántica nueva):
--     solo oportunidades `published`, no rejected/flagged y con turnos
--     one_day_shift no finalizados (public.opportunity_is_publicly_
--     distributable) Y visibles para el solicitante (visibility <> 'private';
--     el resto de visibilidades quedan además sujetas al RLS SELECT propio).
--     draft/closed/filled/cancelled/rejected/flagged/turno terminado ⇒ NO.
--
--   * Quién solicita: SOLO authenticated como auth.uid() (RLS); prohibido
--     auto-solicitar la oportunidad propia (creator_id). El mensaje es
--     opcional, se normaliza con btrim y queda NULL si llega vacío.
--
--   * Quién gestiona: el MISMO perímetro que opportunities_update_manage
--     (creator, miembro del proyecto anclado, miembro de la organización
--     anclada, admin de plataforma), centralizado en
--     public.can_manage_opportunity(uuid) SECURITY DEFINER.
--
--   * Bloqueos: si applicant y creator se bloquearon en cualquier dirección
--     no hay NUEVAS candidaturas (public.profiles_can_interact, fase 9). Las
--     históricas se conservan.
--
--   * Transiciones y permisos finos en TRIGGER (invoker): el RLS deja pasar
--     a implicados; el trigger decide qué columna/estado puede tocar cada
--     actor. El applicant solo puede withdraw su candidatura pendiente y
--     editar su mensaje mientras esté pendiente; el manager solo viewed/
--     accepted/rejected. id/opportunity_id/applicant_id/created_at son
--     inmutables (además de prevent_id_change).
--
--   * Sin DELETE: preferencia por withdrawn. Sin política ni grant DELETE.
--
--   * Plazas one_day_shift: DERIVADAS por agregación
--     (accepted_count vía RPC), sin columnas contador mutables. El ciclo de
--     vida de la oportunidad sigue siendo manual del manager (no hay
--     auto-filled automático: decisión documentada en PROGRESS.md).
--
--   * Outbox REUTILIZADO: se amplía interaction_events_type_check con los
--     eventos application_* y se escriben con triggers SECURITY DEFINER,
--     patrón exacto de fase 9. No hay segunda outbox.
--
--   * ACL "revoke-first": tablas y funciones nuevas sin privilegios por
--     defecto; grants mínimos explícitos. Anon: CERO acceso. Las funciones
--     de trigger no son invocables por nadie (fail-closed).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. OUTBOX COMPARTIDO: nuevos tipos de evento (additivo, sin perder valores)
-- ----------------------------------------------------------------------------

alter table public.interaction_events
  drop constraint interaction_events_type_check;

alter table public.interaction_events
  add constraint interaction_events_type_check check (
    event_type in (
      'comment_created', 'reply_created', 'feedback_received', 'reaction_received',
      'application_submitted', 'application_viewed', 'application_accepted',
      'application_rejected', 'application_withdrawn'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. HELPERS DE PERMISOS (SECURITY DEFINER, search_path vacío)
-- ----------------------------------------------------------------------------

-- ¿Puede el usuario actual gestionar las candidaturas de esta oportunidad?
-- Espejo EXACTO del USING de opportunities_update_manage (fase 6):
-- creator personal, miembro del proyecto anclado, miembro de la organización
-- anclada o admin de plataforma. Fail-closed: ids nulos/inexistentes ⇒ false.
create or replace function public.can_manage_opportunity(p_opportunity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.opportunities o
    where o.id = p_opportunity_id
      and (
        o.creator_id = auth.uid()
        or (o.project_id is not null and public.is_project_member(o.project_id))
        or (o.organization_id is not null and public.is_organization_member(o.organization_id))
        or public.is_platform_admin()
      )
  );
$$;

revoke execute on function public.can_manage_opportunity(uuid) from public;
revoke execute on function public.can_manage_opportunity(uuid) from anon;
revoke execute on function public.can_manage_opportunity(uuid) from authenticated;
grant execute on function public.can_manage_opportunity(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. TABLA applications
-- ----------------------------------------------------------------------------

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  viewed_at timestamptz,
  decided_at timestamptz,
  withdrawn_at timestamptz,
  constraint applications_status_check check (
    status in ('submitted', 'viewed', 'accepted', 'rejected', 'withdrawn')
  ),
  -- Mensaje opcional: si llega presente debe tener contenido razonable.
  constraint applications_message_length_check check (
    message is null or char_length(btrim(message)) between 1 and 2000
  ),
  -- Una sola candidatura por persona y oportunidad, jamás dos filas.
  constraint applications_opportunity_applicant_unique unique (opportunity_id, applicant_id)
);

-- opportunity_id ya queda cubierto por el índice UNIQUE compuesto.
create index if not exists applications_applicant_created_idx
  on public.applications (applicant_id, created_at);
create index if not exists applications_opportunity_status_idx
  on public.applications (opportunity_id, status);

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.handle_updated_at();

drop trigger if exists applications_prevent_id_change on public.applications;
create trigger applications_prevent_id_change
  before update on public.applications
  for each row execute function public.prevent_id_change();

-- Normaliza el mensaje (btrim + vacío⇒NULL) en insert y update.
create or replace function public.applications_normalize_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.message := nullif(btrim(new.message), '');
  return new;
end;
$$;

drop trigger if exists applications_normalize_message_trigger on public.applications;
create trigger applications_normalize_message_trigger
  before insert or update on public.applications
  for each row execute function public.applications_normalize_message();

-- Máquina de estados + permisos finos por actor (el RLS deja pasar a los
-- implicados; este trigger decide QUÉ puede hacer cada uno).
create or replace function public.applications_validate_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_is_applicant boolean;
  v_is_manager boolean;
  v_valid boolean;
begin
  if tg_op = 'INSERT' then
    -- Toda candidatura nace submitted y sin huellas de decisión.
    if new.status <> 'submitted' then
      raise exception 'APPLICATION_INVALID_INITIAL_STATUS';
    end if;
    new.viewed_at := null;
    new.decided_at := null;
    new.withdrawn_at := null;
    return new;
  end if;

  -- tg_op = 'UPDATE' ---------------------------------------------------------

  -- Inmutabilidad dura: identidad y creación nunca cambian.
  if new.id is distinct from old.id
    or new.opportunity_id is distinct from old.opportunity_id
    or new.applicant_id is distinct from old.applicant_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'APPLICATION_IMMUTABLE_FIELDS';
  end if;

  v_is_applicant := v_actor = old.applicant_id;
  v_is_manager := public.can_manage_opportunity(old.opportunity_id);

  if not (v_is_applicant or v_is_manager) then
    raise exception 'APPLICATION_FORBIDDEN';
  end if;

  if new.status <> old.status then
    -- Transiciones válidas (aceptadas/explícitas; nada vuelve hacia atrás).
    v_valid := (
      (old.status = 'submitted'
        and new.status in ('viewed', 'accepted', 'rejected', 'withdrawn'))
      or
      (old.status = 'viewed'
        and new.status in ('accepted', 'rejected', 'withdrawn'))
    );
    if not v_valid then
      raise exception 'APPLICATION_INVALID_TRANSITION';
    end if;

    -- Solo el applicant retira; solo el manager marca vista/acepta/rechaza.
    if v_is_applicant and new.status <> 'withdrawn' then
      raise exception 'APPLICATION_APPLICANT_ONLY_WITHDRAW';
    end if;
    if v_is_manager and not v_is_applicant
      and new.status not in ('viewed', 'accepted', 'rejected')
    then
      raise exception 'APPLICATION_MANAGER_ONLY_DECISIONS';
    end if;

    -- Huellas de tiempo coherentes con el nuevo estado (fuente: BD, no cliente).
    if new.status = 'viewed' then
      new.viewed_at := now();
    elsif new.status in ('accepted', 'rejected') then
      new.decided_at := now();
    elsif new.status = 'withdrawn' then
      new.withdrawn_at := now();
      new.decided_at := null;
    end if;
  else
    -- Sin cambio de estado, las huellas de tiempo no se tocan a mano.
    new.viewed_at := old.viewed_at;
    new.decided_at := old.decided_at;
    new.withdrawn_at := old.withdrawn_at;
  end if;

  -- El mensaje solo lo edita el applicant y solo mientras está pendiente.
  if new.message is distinct from old.message then
    if not v_is_applicant then
      raise exception 'APPLICATION_MESSAGE_APPLICANT_ONLY';
    end if;
    if old.status not in ('submitted', 'viewed')
      or new.status not in ('submitted', 'viewed')
    then
      raise exception 'APPLICATION_MESSAGE_LOCKED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_validate_transition_trigger on public.applications;
create trigger applications_validate_transition_trigger
  before insert or update on public.applications
  for each row execute function public.applications_validate_transition();

alter table public.applications enable row level security;

-- Lectura: el applicant ve lo suyo; quien gestiona la oportunidad ve sus
-- candidaturas. Anon: sin políticas ⇒ cero acceso.
drop policy if exists "applications_select_own" on public.applications;
create policy "applications_select_own"
  on public.applications for select
  to authenticated
  using (auth.uid() = applicant_id);

drop policy if exists "applications_select_manager" on public.applications;
create policy "applications_select_manager"
  on public.applications for select
  to authenticated
  using (public.can_manage_opportunity(opportunity_id));

-- Alta: solo como uno mismo, sin auto-postularse y solo si la oportunidad es
-- distribuible (publicada, no moderada en contra, turno vivo), visible
-- (no private) y sin bloqueo mutuo con el publicador.
drop policy if exists "applications_insert_own" on public.applications;
create policy "applications_insert_own"
  on public.applications for insert
  to authenticated
  with check (
    auth.uid() = applicant_id
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id
        and o.visibility <> 'private'
        and o.creator_id <> auth.uid()
        and public.opportunity_is_publicly_distributable(
          o.status, o.visibility, o.moderation_status, o.opportunity_type, o.ends_at
        )
        and public.profiles_can_interact(auth.uid(), o.creator_id)
    )
  );

-- Modificación: implicados en fila; el refinado por columnas/estados/actor
-- vive en applications_validate_transition().
drop policy if exists "applications_update_involved" on public.applications;
create policy "applications_update_involved"
  on public.applications for update
  to authenticated
  using (
    auth.uid() = applicant_id
    or public.can_manage_opportunity(opportunity_id)
  )
  with check (
    auth.uid() = applicant_id
    or public.can_manage_opportunity(opportunity_id)
  );

-- Sin política DELETE y sin grant DELETE: retirar = withdrawn.

revoke all privileges on table public.applications from public;
revoke all privileges on table public.applications from anon;
revoke all privileges on table public.applications from authenticated;
grant select, insert, update on table public.applications to authenticated;

revoke all privileges on function public.applications_normalize_message() from public, anon, authenticated;
revoke all privileges on function public.applications_validate_transition() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. CONTEOS POR AGREGACIÓN (SECURITY DEFINER; fail-closed al perímetro manager)
-- ----------------------------------------------------------------------------
-- Solo devuelve conteos de oportunidades que el llamador gestiona: para el
-- resto ni siquiera revela existencia de filas. accepted_count alimenta
-- "X aceptados / Y necesarios" de one_day_shift SIN contadores mutables.

create or replace function public.get_application_counts(p_opportunity_ids uuid[])
returns table (opportunity_id uuid, total bigint, accepted_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    (select count(*) from public.applications a where a.opportunity_id = o.id) as total,
    (select count(*) from public.applications a
      where a.opportunity_id = o.id and a.status = 'accepted') as accepted_count
  from public.opportunities o
  where o.id = any (p_opportunity_ids)
    and public.can_manage_opportunity(o.id);
$$;

revoke execute on function public.get_application_counts(uuid[]) from public;
revoke execute on function public.get_application_counts(uuid[]) from anon;
revoke execute on function public.get_application_counts(uuid[]) from authenticated;
grant execute on function public.get_application_counts(uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. EVENTOS AL OUTBOX COMPARTIDO (patrón fase 9; consumidor en FASE 10)
-- ----------------------------------------------------------------------------

create or replace function public.interaction_event_application_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.interaction_events (event_type, actor_id, payload)
  values (
    'application_submitted',
    new.applicant_id,
    jsonb_build_object(
      'application_id', new.id,
      'opportunity_id', new.opportunity_id,
      'applicant_id', new.applicant_id
    )
  );
  return new;
end;
$$;

create or replace function public.interaction_event_application_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> old.status then
    insert into public.interaction_events (event_type, actor_id, payload)
    values (
      case new.status
        when 'viewed' then 'application_viewed'
        when 'accepted' then 'application_accepted'
        when 'rejected' then 'application_rejected'
        when 'withdrawn' then 'application_withdrawn'
        else null
      end,
      coalesce(auth.uid(), new.applicant_id),
      jsonb_build_object(
        'application_id', new.id,
        'opportunity_id', new.opportunity_id,
        'applicant_id', new.applicant_id,
        'status', new.status
      )
    );
  end if;
  return new;
end;
$$;

-- Funciones de trigger: no invocables directamente por nadie (fail-closed).
revoke all privileges on function public.interaction_event_application_insert() from public, anon, authenticated;
revoke all privileges on function public.interaction_event_application_update() from public, anon, authenticated;

drop trigger if exists applications_event_insert_trigger on public.applications;
create trigger applications_event_insert_trigger
  after insert on public.applications
  for each row execute function public.interaction_event_application_insert();

drop trigger if exists applications_event_update_trigger on public.applications;
create trigger applications_event_update_trigger
  after update on public.applications
  for each row execute function public.interaction_event_application_update();

commit;
