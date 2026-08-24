-- ============================================================================
-- FASE 10 — Mensajería 1:1 + Notificaciones
-- ============================================================================
-- Diseño:
--
--   NOTIFICACIONES
--   - public.notifications: una fila por evento relevante para un recipiente.
--     Sin snapshots (solo IDs de contexto), sin INSERT/DELETE para clientes.
--   - Consumo del outbox EXISTENTE interaction_events mediante trigger
--     AFTER INSERT (row) que resuelve el destinatario, inserta la notificación
--     y marca processed_at. Un trigger statement-level hace retención
--     oportunista (borra eventos procesados > 30 días). Sin cron.
--   - Nuevos orígenes de eventos reutilizando el MISMO outbox: new_follow
--     (trigger en profile_follows) y message_received (trigger en messages).
--     Se amplía el CHECK event_type. reaction_received NO genera notificación
--     (ruido; decisión MVP documentada).
--   - Anti-duplicado: cada fila del outbox produce exactamente una notificación
--     (transacción única); self-notificaciones y pares bloqueados se saltan.
--
--   MENSAJERÍA DM 1:1
--   - conversations (+ dm_low/dm_high ordenados, UNIQUE par → 1 conversación
--     por pareja; columnas null reservan grupos futuros sin complicar nada).
--   - conversation_members (PK compuesta; last_read_at para unread).
--   - messages (body trim/CHECK 1..2000, edited_at; sin DELETE).
--   - get_or_create_dm(p_target): SECURITY DEFINER justificado: debe crear la
--     membresía del OTRO usuario (imposible con RLS invoker sin abrir huecos),
--     idempotente por UNIQUE(dm_low,dm_high) + ON CONFLICT en memberships,
--     actor SIEMPRE auth.uid(), self-DM denegado, bloqueos denegados vía
--     profiles_can_interact (reutilizada).
--   - Bloqueos: no crean conversación ni permiten nuevos mensajes; el
--     historial previo sigue visible para sus participantes (RLS member).
--   - Privacidad: ninguna tabla nueva es pública; anon sin grants ni políticas;
--     fuera de search/feed/analytics (no participan: search_text solo en sus
--     tablas; RPCs nuevas fail-closed authenticated-only).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  event_type   text not null,
  entity_id    uuid not null,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  constraint notifications_event_type_check check (
    event_type = any (array [
      'new_follow'::text,
      'comment_created'::text,
      'reply_created'::text,
      'feedback_received'::text,
      'application_submitted'::text,
      'application_viewed'::text,
      'application_accepted'::text,
      'application_rejected'::text,
      'message_received'::text
    ])
  )
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

-- Guard: solo read_at es mutable por el propietario; resto inmutable.
create or replace function public.notifications_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recipient_id <> old.recipient_id
     or new.actor_id is distinct from old.actor_id
     or new.event_type <> old.event_type
     or new.entity_id <> old.entity_id
     or new.created_at <> old.created_at then
    raise exception 'NOTIFICATION_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard_update_trigger on public.notifications;
create trigger notifications_guard_update_trigger
before update on public.notifications
for each row execute function public.notifications_guard_update();

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications for select to authenticated
using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2) Outbox: ampliar event_type con new_follow + message_received
-- ---------------------------------------------------------------------------
alter table public.interaction_events
  drop constraint if exists interaction_events_type_check;
alter table public.interaction_events
  add constraint interaction_events_type_check check (
    event_type = any (array [
      'comment_created'::text,
      'reply_created'::text,
      'feedback_received'::text,
      'reaction_received'::text,
      'application_submitted'::text,
      'application_viewed'::text,
      'application_accepted'::text,
      'application_rejected'::text,
      'application_withdrawn'::text,
      'new_follow'::text,
      'message_received'::text
    ])
  );

create index if not exists interaction_events_processed_created_idx
  on public.interaction_events (created_at)
  where processed_at is not null;

-- Trigger origen: follows de perfiles → evento new_follow.
create or replace function public.interaction_event_profile_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.interaction_events (event_type, actor_id, payload)
  values (
    'new_follow',
    new.profile_id,
    jsonb_build_object(
      'follower_id', new.profile_id,
      'followed_id', new.following_id
    )
  );
  return new;
end;
$$;

drop trigger if exists profile_follows_event_trigger on public.profile_follows;
create trigger profile_follows_event_trigger
after insert on public.profile_follows
for each row execute function public.interaction_event_profile_follow();

-- ---------------------------------------------------------------------------
-- 3) conversations / conversation_members / messages
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  -- Par ordenado SOLO para DM 1:1; null/null reserva grupos futuros.
  dm_low          uuid references public.profiles (id) on delete cascade,
  dm_high         uuid references public.profiles (id) on delete cascade,
  constraint conversations_dm_shape check (
    (dm_low is null and dm_high is null)
    or (dm_low is not null and dm_high is not null and dm_low < dm_high)
  )
);

create unique index if not exists conversations_dm_pair_unique
  on public.conversations (dm_low, dm_high);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create index if not exists conversation_members_profile_idx
  on public.conversation_members (profile_id, joined_at);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id),
  body            text not null,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  constraint messages_body_length_check
    check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_sender_created_idx
  on public.messages (sender_id, created_at);

-- Normaliza body (trim) antes de validar.
create or replace function public.messages_normalize_body()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.body := btrim(new.body);
  return new;
end;
$$;

drop trigger if exists messages_normalize_body_trigger on public.messages;
create trigger messages_normalize_body_trigger
before insert or update on public.messages
for each row execute function public.messages_normalize_body();

-- Identidad estable: sender/conversación/creación inmutables.
create or replace function public.messages_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.conversation_id <> old.conversation_id
     or new.sender_id <> old.sender_id
     or new.created_at <> old.created_at then
    raise exception 'MESSAGE_IMMUTABLE';
  end if;
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard_update_trigger on public.messages;
create trigger messages_guard_update_trigger
before update on public.messages
for each row execute function public.messages_guard_update();

-- Fan-out: last_message_at + evento message_received en el MISMO outbox.
create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c
     set last_message_at = new.created_at
   where c.id = new.conversation_id;

  insert into public.interaction_events (event_type, actor_id, payload)
  values (
    'message_received',
    new.sender_id,
    jsonb_build_object(
      'message_id', new.id,
      'conversation_id', new.conversation_id,
      'sender_id', new.sender_id
    )
  );
  return new;
end;
$$;

drop trigger if exists messages_after_insert_trigger on public.messages;
create trigger messages_after_insert_trigger
after insert on public.messages
for each row execute function public.messages_after_insert();

-- Miembro solo puede tocar su propia fila de membresía y únicamente
-- last_read_at (marcar conversación leída).
create or replace function public.conversation_members_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profile_id <> old.profile_id
     or new.conversation_id <> old.conversation_id
     or new.joined_at <> old.joined_at then
    raise exception 'MEMBERSHIP_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists conversation_members_guard_update_trigger on public.conversation_members;
create trigger conversation_members_guard_update_trigger
before update on public.conversation_members
for each row execute function public.conversation_members_guard_update();

-- ---------------------------------------------------------------------------
-- 4) Helpers SECURITY DEFINER (patrón can_manage_opportunity)
-- ---------------------------------------------------------------------------

-- ¿Es auth.uid() miembro de la conversación? Necesaria porque las políticas
-- de messages/members deben ver filas de OTROS miembros sin exponerlas.
create or replace function public.messaging_is_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.profile_id = auth.uid()
  );
$$;

-- ¿Hay bloqueo en cualquier dirección entre los miembros de la conversación?
create or replace function public.messaging_dm_blocked(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members a
    join public.conversation_members b
      on b.conversation_id = a.conversation_id
     and b.profile_id <> a.profile_id
    join public.profile_blocks pb
      on (pb.profile_id = a.profile_id and pb.blocked_id = b.profile_id)
      or (pb.profile_id = b.profile_id and pb.blocked_id = a.profile_id)
    where a.conversation_id = p_conversation_id
  );
$$;

-- RPC idempotente get_or_create_dm: UNA conversación por par, sin self-DM,
-- sin bloqueos, actor = auth.uid(). SECURITY DEFINER: crea la membresía del
-- otro participante (con RLS invoker sería imposible sin permitir inserts
-- arbitrarios de membresías).
create or replace function public.get_or_create_dm(p_target_profile_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me              uuid := auth.uid();
  v_low             uuid;
  v_high            uuid;
  v_conversation_id uuid;
begin
  if v_me is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_target_profile_id is null or p_target_profile_id = v_me then
    raise exception 'SELF_DM_DENIED';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = p_target_profile_id
  ) then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  if not public.profiles_can_interact(v_me, p_target_profile_id) then
    raise exception 'BLOCKED';
  end if;

  v_low  := least(v_me, p_target_profile_id);
  v_high := greatest(v_me, p_target_profile_id);

  select c.id into v_conversation_id
  from public.conversations c
  where c.dm_low = v_low and c.dm_high = v_high;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  begin
    insert into public.conversations (created_by, dm_low, dm_high)
    values (v_me, v_low, v_high)
    returning id into v_conversation_id;
  exception when unique_violation then
    select c.id into v_conversation_id
    from public.conversations c
    where c.dm_low = v_low and c.dm_high = v_high;
  end;

  insert into public.conversation_members (conversation_id, profile_id)
  values (v_conversation_id, v_me), (v_conversation_id, p_target_profile_id)
  on conflict (conversation_id, profile_id) do nothing;

  return v_conversation_id;
end;
$$;

-- Conteo de mensajes no leídos (invoker: la RLS acota al propio perímetro;
-- fail-closed natural). Derivado, NUNCA contador mutable.
create or replace function public.get_unread_messages_total()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.messages m
  join public.conversation_members cm
    on cm.conversation_id = m.conversation_id
   and cm.profile_id = auth.uid()
  where m.created_at > cm.last_read_at
    and m.sender_id <> auth.uid()
$$;

-- Conteo de notificaciones no leídas (invoker + RLS own).
create or replace function public.get_unread_notification_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.notifications n
  where n.recipient_id = auth.uid()
    and n.read_at is null
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS mensajería
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member
on public.conversations for select to authenticated
using (public.messaging_is_member(id));

drop policy if exists conversation_members_select_member on public.conversation_members;
create policy conversation_members_select_member
on public.conversation_members for select to authenticated
using (public.messaging_is_member(conversation_id));

drop policy if exists conversation_members_update_own on public.conversation_members;
create policy conversation_members_update_own
on public.conversation_members for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member
on public.messages for select to authenticated
using (public.messaging_is_member(conversation_id));

-- INSERT: remitente real + miembro + sin bloqueos (historial previo sigue
-- siendo legible; los nuevos mensajes quedan bloqueados).
drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.messaging_is_member(conversation_id)
  and not public.messaging_dm_blocked(conversation_id)
);

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own
on public.messages for update to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

-- Sin políticas DELETE: la mensajería MVP no borra mensajes.

-- ---------------------------------------------------------------------------
-- 6) ACL revoke-first
-- ---------------------------------------------------------------------------
revoke all on public.notifications from public;
revoke all on public.notifications from anon;
revoke all on public.notifications from authenticated;
grant select, update on public.notifications to authenticated;

revoke all on public.conversations from public;
revoke all on public.conversations from anon;
revoke all on public.conversations from authenticated;
grant select on public.conversations to authenticated;

revoke all on public.conversation_members from public;
revoke all on public.conversation_members from anon;
revoke all on public.conversation_members from authenticated;
grant select, update on public.conversation_members to authenticated;

revoke all on public.messages from public;
revoke all on public.messages from anon;
revoke all on public.messages from authenticated;
grant select, insert, update on public.messages to authenticated;

-- Grants explícitos mínimos (revoke-first por firma exacta):
revoke all on function public.messaging_is_member(uuid) from public, anon, authenticated;
grant execute on function public.messaging_is_member(uuid) to authenticated;

revoke all on function public.messaging_dm_blocked(uuid) from public, anon, authenticated;
grant execute on function public.messaging_dm_blocked(uuid) to authenticated;

revoke all on function public.get_or_create_dm(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

revoke all on function public.get_unread_messages_total() from public, anon, authenticated;
grant execute on function public.get_unread_messages_total() to authenticated;

revoke all on function public.get_unread_notification_count() from public, anon, authenticated;
grant execute on function public.get_unread_notification_count() to authenticated;

-- Funciones internas de triggers: sin EXECUTE externo.
revoke all on function public.notifications_guard_update() from public, anon, authenticated;
revoke all on function public.interaction_event_profile_follow() from public, anon, authenticated;
revoke all on function public.messages_normalize_body() from public, anon, authenticated;
revoke all on function public.messages_guard_update() from public, anon, authenticated;
revoke all on function public.messages_after_insert() from public, anon, authenticated;
revoke all on function public.conversation_members_guard_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) Consumidor del outbox → notifications (+ retención oportunista)
-- ---------------------------------------------------------------------------
create or replace function public.notifications_from_interaction_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor     uuid := coalesce(new.actor_id, auth.uid());
  v_recipient uuid;
  v_entity    uuid;
begin
  case new.event_type
    when 'new_follow' then
      v_recipient := (new.payload ->> 'followed_id')::uuid;
      v_entity    := coalesce(
        (new.payload ->> 'followed_id')::uuid,
        (new.payload ->> 'follower_id')::uuid
      );
    when 'comment_created', 'reply_created' then
      select p.author_id into v_recipient
      from public.posts p
      where p.id = (new.payload ->> 'post_id')::uuid;
      v_entity := coalesce(
        (new.payload ->> 'comment_id')::uuid,
        (new.payload ->> 'post_id')::uuid
      );
    when 'feedback_received' then
      select pr.owner_id into v_recipient
      from public.projects pr
      where pr.id = (new.payload ->> 'project_id')::uuid;
      v_entity := coalesce(
        (new.payload ->> 'feedback_id')::uuid,
        (new.payload ->> 'project_id')::uuid
      );
    when 'application_submitted', 'application_viewed',
         'application_accepted', 'application_rejected',
         'application_withdrawn' then
      if new.event_type in ('application_submitted', 'application_withdrawn') then
        select o.creator_id into v_recipient
        from public.opportunities o
        where o.id = (new.payload ->> 'opportunity_id')::uuid;
      elsif (new.payload ->> 'applicant_id') is not null then
        v_recipient := (new.payload ->> 'applicant_id')::uuid;
      else
        select a.applicant_id into v_recipient
        from public.applications a
        where a.id = (new.payload ->> 'application_id')::uuid;
      end if;
      v_entity := coalesce(
        (new.payload ->> 'application_id')::uuid,
        (new.payload ->> 'opportunity_id')::uuid
      );
    when 'message_received' then
      select cm.profile_id into v_recipient
      from public.conversation_members cm
      where cm.conversation_id = (new.payload ->> 'conversation_id')::uuid
        and cm.profile_id <> v_actor
      limit 1;
      -- La conversación manda: habilita el deep-link /mensajes/{id}.
      v_entity := coalesce(
        (new.payload ->> 'conversation_id')::uuid,
        (new.payload ->> 'message_id')::uuid
      );
    else
      -- reaction_received y futuros desconocidos: sin notificación (ruido MVP).
      v_recipient := null;
  end case;

  if v_recipient is not null
     and v_entity is not null
     and v_recipient <> v_actor
     and coalesce(public.profiles_can_interact(v_recipient, v_actor), false) then
    insert into public.notifications (recipient_id, actor_id, event_type, entity_id)
    values (v_recipient, nullif(v_actor, v_recipient), new.event_type, v_entity);
  end if;

  update public.interaction_events e
     set processed_at = now()
   where e.id = new.id;

  return new;
end;
$$;

-- Trigger interno: sin EXECUTE externo.
revoke all on function public.notifications_from_interaction_event()
from public, anon, authenticated;

drop trigger if exists interaction_events_notifications_trigger on public.interaction_events;
create trigger interaction_events_notifications_trigger
after insert on public.interaction_events
for each row execute function public.notifications_from_interaction_event();

-- Retención: los eventos procesados > 30 días desaparecen; sin cron. Se
-- ejecuta UNA vez por statement de inserción (no por fila).
create or replace function public.interaction_events_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.interaction_events
   where processed_at is not null
     and created_at < now() - interval '30 days';
  return null;
end;
$$;

revoke all on function public.interaction_events_retention()
from public, anon, authenticated;

drop trigger if exists interaction_events_retention_trigger on public.interaction_events;
create trigger interaction_events_retention_trigger
after insert on public.interaction_events
for each statement execute function public.interaction_events_retention();
