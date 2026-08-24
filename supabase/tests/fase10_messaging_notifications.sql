-- ============================================================================
-- FASE 10 — Verificación de invariantes (mensajería DM + notificaciones)
-- ============================================================================
-- Comprueba la migración 20260822000000_fase10_messaging_notifications.sql:
--
--   1. ACL mínima: anon SIN ningún privilegio en notifications/conversations/
--      conversation_members/messages ni EXECUTE en las funciones nuevas;
--      authenticated con grants exactos (sin DELETE en mensajes, sin INSERT
--      directo en conversaciones/miembros/notificaciones) y EXECUTE solo en
--      las RPC de usuario; funciones internas de triggers sin EXECUTE.
--   2. DM única por pareja vía get_or_create_dm (idempotente en ambos sentidos,
--      par ordenado dm_low/dm_high), self-DM denegado, target inexistente
--      denegado, bloqueo denegado (BLOCKED), desbloqueo restaura.
--   3. Mensajes: trim aplicado, CHECK 1..2000, no-miembro no lee ni escribe,
--      sender arbitrario denegado por RLS, edición propia marca edited_at,
--      edición ajena denegada, identidad del remitente inmutable
--      (MESSAGE_IMMUTABLE), last_message_at se actualiza.
--   4. Bloqueos posteriores: historial previo sigue legible para los miembros,
--      pero NUEVOS mensajes denegados en ambas direcciones.
--   5. Outbox → notifications: new_follow, comment_created, reply_created
--      (self-skip), feedback_received, application_submitted/accepted,
--      message_received; reaction_processed SIN notificación (ruido MVP);
--      eventos entre bloqueados quedan procesados sin notificar; cada evento
--      produce exactamente una notificación (processed_at como cursor).
--   6. Lectura: solo recipiente; marcar leída lo propio; unread counts RPC
--      fail-closed y derivados (sin contadores mutables).
--   7. Privacidad: anon ve cero filas en las cuatro tablas nuevas.
--   8. Retención: eventos procesados > 30 días eliminados sin cron.
--
-- Cómo ejecutarlo (stack LOCAL, como postgres, tras aplicar TODAS las
-- migraciones):  psql "$SUPABASE_DB_URL" -f supabase/tests/fase10_....sql
-- Requiere superusuario. NO ejecutar contra la base remota. Transacción que se
-- REVIERTE al final.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Setup: identidades y contenido público de prueba (como postgres)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, username, full_name, is_public)
values
  ('00000000-0000-0000-0000-000000000001', 'alice', 'Alice', true),
  ('00000000-0000-0000-0000-000000000002', 'bob', 'Bob', true),
  ('00000000-0000-0000-0000-000000000003', 'carol', 'Carol', true),
  ('00000000-0000-0000-0000-000000000004', 'dave', 'Dave', true);

insert into public.projects (id, owner_id, slug, name, stage, status, is_public)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        'proyecto-alice-f10', 'Proyecto Alice F10', 'idea', 'published', true);

insert into public.opportunities (id, creator_id, title, description, opportunity_type, status, visibility)
values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        'Puesto Alice F10', 'Descripción suficientemente larga para la prueba.',
        'job', 'published', 'public');

-- Vídeos públicos: sus posts sincronizados (P1 alice, P2 dave) sirven para
-- comentarios/reply y para el escenario de evento entre bloqueados.
insert into public.videos (id, owner_id, title, mime_type, size_bytes, storage_bucket, storage_path, status, processing_status, visibility, moderation_status)
values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Vídeo Alice F10', 'video/mp4', 1024, 'videos', 'f10/v1.mp4', 'published', 'ready', 'public', 'approved'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'Vídeo Dave F10', 'video/mp4', 1024, 'videos', 'f10/v2.mp4', 'published', 'ready', 'public', 'approved');

do $$
begin
  if (select count(*) from public.posts where publication_status = 'published') < 2 then
    raise exception 'FALLO SETUP: los posts sincronizados no se crearon';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- TEST 1: ACL mínima
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if has_table_privilege('anon', 'public.notifications', 'SELECT')
    or has_table_privilege('anon', 'public.conversations', 'SELECT')
    or has_table_privilege('anon', 'public.conversation_members', 'SELECT')
    or has_table_privilege('anon', 'public.messages', 'SELECT') then
    raise exception 'FALLO TEST1: anon puede leer tablas de mensajería/notificaciones';
  end if;
  if has_function_privilege('anon', 'public.get_or_create_dm(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_unread_messages_total()', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_unread_notification_count()', 'EXECUTE')
    or has_function_privilege('anon', 'public.messaging_is_member(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.messaging_dm_blocked(uuid)', 'EXECUTE') then
    raise exception 'FALLO TEST1: anon ejecuta funciones de FASE 10';
  end if;
  raise notice 'PASS TEST1: anon sin acceso a mensajería/notificaciones';
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if not has_table_privilege('authenticated', 'public.notifications', 'SELECT')
    or not has_table_privilege('authenticated', 'public.notifications', 'UPDATE') then
    raise exception 'FALLO TEST1: authenticated debería leer/marcar sus notificaciones';
  end if;
  if has_table_privilege('authenticated', 'public.notifications', 'INSERT')
    or has_table_privilege('authenticated', 'public.notifications', 'DELETE') then
    raise exception 'FALLO TEST1: authenticated crea/borra notificaciones directamente';
  end if;
  if has_table_privilege('authenticated', 'public.conversations', 'INSERT')
    or has_table_privilege('authenticated', 'public.conversations', 'UPDATE')
    or has_table_privilege('authenticated', 'public.conversation_members', 'INSERT') then
    raise exception 'FALLO TEST1: authenticated manipula conversaciones/membresías fuera de la RPC';
  end if;
  if has_table_privilege('authenticated', 'public.messages', 'DELETE') then
    raise exception 'FALLO TEST1: authenticated borra mensajes (MVP: sin DELETE)';
  end if;
  if not has_function_privilege('authenticated', 'public.get_or_create_dm(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_unread_notification_count()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_unread_messages_total()', 'EXECUTE') then
    raise exception 'FALLO TEST1: faltan grants de usuario para las RPC de FASE 10';
  end if;
  if has_function_privilege('authenticated', 'public.messages_after_insert()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.notifications_from_interaction_event()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.interaction_event_profile_follow()', 'EXECUTE') then
    raise exception 'FALLO TEST1: funciones internas ejecutables desde fuera';
  end if;
  raise notice 'PASS TEST1: grants exactos para authenticated';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 2: DM única por pareja (get_or_create_dm idempotente)
-- ---------------------------------------------------------------------------
do $$
declare
  v_from_alice uuid;
  v_from_bob   uuid;
begin
  select public.get_or_create_dm('00000000-0000-0000-0000-000000000002')
    into v_from_alice;
  if v_from_alice is null then
    raise exception 'FALLO TEST2: la RPC no devolvió conversación';
  end if;

  select public.get_or_create_dm('00000000-0000-0000-0000-000000000001')
    into v_from_bob;
  if v_from_bob <> v_from_alice then
    raise exception 'FALLO TEST2: segunda llamada creó OTRA conversación';
  end if;

  if (select count(*) from public.conversations) <> 1 then
    raise exception 'FALLO TEST2: debería existir EXACTAMENTE una conversación';
  end if;
  if (select count(*) from public.conversation_members) <> 2 then
    raise exception 'FALLO TEST2: deberían existir exactamente 2 miembros';
  end if;
  if (select dm_low < dm_high from public.conversations limit 1) is not true then
    raise exception 'FALLO TEST2: el par dm_low/dm_high no está ordenado';
  end if;
  raise notice 'PASS TEST2: DM única e idempotente (ambos sentidos)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 3: self-DM, target inexistente y bloqueos previos
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    perform public.get_or_create_dm('00000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST3: bob pudo auto-envarse un DM';
  exception
    when others then
      if sqlerrm like '%FALLO TEST3%' then raise; end if;
      if position('SELF_DM_DENIED' in sqlerrm) = 0 then
        raise exception 'FALLO TEST3: error inesperado en self-DM: %', sqlerrm;
      end if;
  end;

  begin
    perform public.get_or_create_dm('99999999-9999-9999-9999-999999999999');
    raise exception 'FALLO TEST3: se aceptó un target inexistente';
  exception
    when others then
      if sqlerrm like '%FALLO TEST3%' then raise; end if;
      if position('TARGET_NOT_FOUND' in sqlerrm) = 0 then
        raise exception 'FALLO TEST3: error inesperado en target inexistente: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST3: self-DM y target desconocido denegados';
end $$;

set local role postgres;
reset role;
insert into public.profile_blocks (profile_id, blocked_id)
values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

do $$
declare
  v_conversation uuid;
begin
  begin
    perform public.get_or_create_dm('00000000-0000-0000-0000-000000000004');
    raise exception 'FALLO TEST3: se creó DM con bloqueo activo (dave→carol)';
  exception
    when others then
      if sqlerrm like '%FALLO TEST3%' then raise; end if;
      if position('BLOCKED' in sqlerrm) = 0 then
        raise exception 'FALLO TEST3: error inesperado con bloqueo: %', sqlerrm;
      end if;
  end;

  -- Desbloqueo: la creación vuelve a funcionar.
  set local role postgres;
  reset role;
  delete from public.profile_blocks
   where profile_id = '00000000-0000-0000-0000-000000000004'
     and blocked_id = '00000000-0000-0000-0000-000000000003';
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

  v_conversation := public.get_or_create_dm('00000000-0000-0000-0000-000000000004');
  if v_conversation is null then
    raise exception 'FALLO TEST3: tras desbloquear no se creó la conversación';
  end if;
  raise notice 'PASS TEST3: bloqueo deniega crear DM; desbloqueo restaura';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 4: mensajes — validaciones, RLS, edición, inmutabilidad
-- ---------------------------------------------------------------------------
do $$
declare
  v_conv        uuid := (select id from public.conversations
                         where dm_low = '00000000-0000-0000-0000-000000000001'
                           and dm_high = '00000000-0000-0000-0000-000000000002');
  v_message     uuid;
  v_rows        int;
begin
  -- Bob envía con espacios: el trigger normaliza (trim).
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv, '00000000-0000-0000-0000-000000000002', '  hola alice  ')
  returning id into v_message;

  if (select body from public.messages where id = v_message) <> 'hola alice' then
    raise exception 'FALLO TEST4: el body no se normalizó con trim';
  end if;

  -- Body vacío / demasiado largo: rechazados.
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, '00000000-0000-0000-0000-000000000002', '   ');
    raise exception 'FALLO TEST4: se aceptó un mensaje vacío';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
  end;

  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, '00000000-0000-0000-0000-000000000002', repeat('x', 2001));
    raise exception 'FALLO TEST4: se aceptó un mensaje >2000';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
  end;

  -- Sender arbitrario: bob intenta firmar como alice → RLS.
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, '00000000-0000-0000-0000-000000000001', 'suplantación');
    raise exception 'FALLO TEST4: se aceptó sender_id ajeno';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
      if sqlstate <> '42501' then
        raise exception 'FALLO TEST4: sender ajeno falló con % (%)', sqlstate, sqlerrm;
      end if;
  end;

  -- No-miembro (carol): cero lectura y escritura denegada.
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
  select count(*) into v_rows
  from public.messages where conversation_id = v_conv;
  if v_rows <> 0 then
    raise exception 'FALLO TEST4: un tercero leyó mensajes ajenos';
  end if;
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, '00000000-0000-0000-0000-000000000003', 'intruso');
    raise exception 'FALLO TEST4: un no-miembro escribió en la conversación';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
  end;

  -- Edición propia marca edited_at; edición ajena no aplica; identidad fija.
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  update public.messages set body = 'hola alice (editado)' where id = v_message;
  if (select edited_at from public.messages where id = v_message) is null then
    raise exception 'FALLO TEST4: editar propio no marcó edited_at';
  end if;

  begin
    update public.messages
       set sender_id = '00000000-0000-0000-0000-000000000001'
     where id = v_message;
    raise exception 'FALLO TEST4: se cambió el remitente de un mensaje';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
      if position('MESSAGE_IMMUTABLE' in sqlerrm) = 0 then
        raise exception 'FALLO TEST4: error inesperado al cambiar sender: %', sqlerrm;
      end if;
  end;

  if (select last_message_at from public.conversations where id = v_conv) is null then
    raise exception 'FALLO TEST4: last_message_at no se actualizó';
  end if;
  raise notice 'PASS TEST4: mensajes válidos, RLS y guardas correctas';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 5: bloqueo posterior — historial visible, nuevos mensajes cerrados
-- ---------------------------------------------------------------------------
set local role postgres;
reset role;
insert into public.profile_blocks (profile_id, blocked_id)
values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

do $$
declare
  v_conv       uuid;
  v_history    int;
  v_unread     int;
begin
  select c.id into v_conv
  from public.conversations c
  where c.dm_low = '00000000-0000-0000-0000-000000000003'
    and c.dm_high = '00000000-0000-0000-0000-000000000004';

  -- Carol sigue viendo su historial (MVP: historial persiste).
  select count(*) into v_history
  from public.messages m where m.conversation_id = v_conv;
  if v_history < 1 then
    raise exception 'FALLO TEST5 setup: falta historial previo carol↔dave';
  end if;

  -- Nuevo mensaje denegado por RLS (bloqueo en cualquier dirección).
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, '00000000-0000-0000-0000-000000000003', '¿sigues ahí?');
    raise exception 'FALLO TEST5: se aceptó mensaje con bloqueo activo';
  exception
    when others then
      if sqlerrm like '%FALLO TEST5%' then raise; end if;
  end;

  -- Y en sentido inverso (dave → carol), también denegado.
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
  select count(*) into v_history
  from public.messages m where m.conversation_id = v_conv;
  if v_history < 1 then
    raise exception 'FALLO TEST5: dave perdió el acceso al historial';
  end if;
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, '00000000-0000-0000-0000-000000000004', 'bloqueo bilateral');
    raise exception 'FALLO TEST5: dave escribió pese al bloqueo propio';
  exception
    when others then
      if sqlerrm like '%FALLO TEST5%' then raise; end if;
  end;

  -- El contador unread sigue funcionando bajo bloqueo (derivado, no mutable).
  select public.get_unread_messages_total() into v_unread;
  if v_unread is null then
    raise exception 'FALLO TEST5: unread total devolvió null';
  end if;
  raise notice 'PASS TEST5: historial visible, nuevos mensajes bloqueados';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 6: outbox → notifications (follow/comentarios/feedback/aplicaciones)
-- ---------------------------------------------------------------------------
set local role postgres;
reset role;

do $$
declare
  v_post_alice  uuid := (select id from public.posts
                         where author_id = '00000000-0000-0000-0000-000000000001'
                         order by created_at limit 1);
  v_before      int;
  v_after       int;
begin
  -- Estado inicial: el DM alice↔bob ya generó 1 message_received para alice.
  select count(*) into v_before from public.notifications
   where recipient_id = '00000000-0000-0000-0000-000000000001';

  -- Bob sigue a Alice → new_follow para alice (trigger de profile_follows).
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  insert into public.profile_follows (profile_id, following_id)
  values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');

  set local role postgres;
  reset role;
  select count(*) into v_after from public.notifications
   where recipient_id = '00000000-0000-0000-0000-000000000001'
     and event_type = 'new_follow';
  if v_after <> 1 then
    raise exception 'FALLO TEST6: new_follow no generó exactamente una notificación';
  end if;

  -- Bob comenta el post de alice → comment_created para alice.
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  insert into public.post_comments (post_id, author_id, body)
  values (v_post_alice, '00000000-0000-0000-0000-000000000002', 'buen vídeo');

  set local role postgres;
  reset role;
  if (select count(*) from public.notifications
       where recipient_id = '00000000-0000-0000-0000-000000000001'
         and event_type = 'comment_created') <> 1 then
    raise exception 'FALLO TEST6: comment_created no llegó a la autora del post';
  end if;

  -- Alice responde a su PROPIO post → self-skip (autor del post = actor).
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  insert into public.post_comments (post_id, author_id, parent_id, body)
  values (v_post_alice, '00000000-0000-0000-0000-000000000001',
          (select id from public.post_comments order by created_at desc limit 1),
          'gracias!');

  set local role postgres;
  reset role;
  if (select count(*) from public.notifications
       where recipient_id = '00000000-0000-0000-0000-000000000001'
         and event_type = 'reply_created') <> 0 then
    raise exception 'FALLO TEST6: self-notificación no se saltó';
  end if;

  -- Feedback de bob sobre el proyecto de alice → feedback_received.
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  insert into public.project_feedback (project_id, author_id, understanding, would_use)
  values ('20000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          'Entiendo el problema que ataca.', 'yes');

  set local role postgres;
  reset role;
  if (select count(*) from public.notifications
       where recipient_id = '00000000-0000-0000-0000-000000000001'
         and event_type = 'feedback_received') <> 1 then
    raise exception 'FALLO TEST6: feedback_received no llegó a la propietaria';
  end if;

  -- reaction_received: evento SÍ existe, notificación NO (ruido MVP).
  insert into public.interaction_events (event_type, actor_id, payload)
  values ('reaction_received', '00000000-0000-0000-0000-000000000002',
          jsonb_build_object('post_id', v_post_alice, 'reaction_type', 'support'));
  if (select count(*) from public.notifications
       where event_type = 'reaction_received') <> 0 then
    raise exception 'FALLO TEST6: reaction_received generó notificación (ruido)';
  end if;
  if (select processed_at from public.interaction_events
       where event_type = 'reaction_received') is null then
    raise exception 'FALLO TEST6: evento de ruido quedó sin procesar';
  end if;

  -- Evento entre bloqueados (carol comenta post de dave, dave la bloquea):
  -- el evento se procesa pero NO se notifica.
  insert into public.interaction_events (event_type, actor_id, payload)
  values ('comment_created', '00000000-0000-0000-0000-000000000003',
          jsonb_build_object(
            'comment_id', gen_random_uuid(),
            'post_id', (select id from public.posts
                        where author_id = '00000000-0000-0000-0000-000000000004'
                        order by created_at limit 1),
            'parent_id', null));
  if (select count(*) from public.notifications n
       join public.profiles p on p.id = n.recipient_id
       where n.event_type = 'comment_created'
         and p.id = '00000000-0000-0000-0000-000000000004') <> 0 then
    raise exception 'FALLO TEST6: se notificó a un par bloqueado';
  end if;
  raise notice 'PASS TEST6: outbox → notifications correcto (incluye self-skip y bloqueos)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 7: aplicaciones → notificaciones (submitted al manager, accepted al
-- applicant) + integración DM tras accept
-- ---------------------------------------------------------------------------
do $$
declare
  v_opportunity uuid := '40000000-0000-0000-0000-000000000001';
  v_application uuid;
begin
  -- Bob aplica a la oportunidad de alice (FASE 8) → evento submitted.
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  insert into public.applications (opportunity_id, applicant_id, message)
  values (v_opportunity, '00000000-0000-0000-0000-000000000002', 'me encaja')
  returning id into v_application;

  set local role postgres;
  reset role;
  if (select count(*) from public.notifications
       where recipient_id = '00000000-0000-0000-0000-000000000001'
         and event_type = 'application_submitted'
         and entity_id = v_application) <> 1 then
    raise exception 'FALLO TEST7: application_submitted no llegó a la manager';
  end if;

  -- Alice acepta → evento accepted → notificación para BOB (el candidato).
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  update public.applications set status = 'accepted' where id = v_application;

  set local role postgres;
  reset role;
  if (select count(*) from public.notifications
       where recipient_id = '00000000-0000-0000-0000-000000000002'
         and event_type = 'application_accepted'
         and entity_id = v_application) <> 1 then
    raise exception 'FALLO TEST7: application_accepted no llegó al candidato';
  end if;

  -- CTA "enviar mensaje": bob abre DM con alice → MISMA conversación de antes.
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  if public.get_or_create_dm('00000000-0000-0000-0000-000000000001')
     is distinct from
     (select id from public.conversations
       where dm_low = '00000000-0000-0000-0000-000000000001'
         and dm_high = '00000000-0000-0000-0000-000000000002') then
    raise exception 'FALLO TEST7: la candidatura aceptada duplicó el DM';
  end if;

  -- La tabla applications no expone nada de mensajería (separación de dominios).
  if to_regclass('public.application_messages') is not null
    or exists (select 1 from information_schema.columns
               where table_schema = 'public'
                 and table_name = 'applications'
                 and column_name like '%message%conversation%') then
    raise exception 'FALLO TEST7: applications filtró hacia mensajería';
  end if;
  raise notice 'PASS TEST7: aplicaciones notifican y la DM sigue siendo única';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 8: lecturas propias, marcar leídas y unread counts derivados
-- ---------------------------------------------------------------------------
do $$
declare
  v_foreign int;
begin
  -- Alice solo ve SUS notificaciones.
  if exists (select 1 from public.notifications
              where recipient_id <> '00000000-0000-0000-0000-000000000001') then
    raise exception 'FALLO TEST8: alice ve notificaciones ajenas';
  end if;

  -- Marca una concreta como leída.
  update public.notifications
     set read_at = now()
   where recipient_id = '00000000-0000-0000-0000-000000000001'
     and event_type = 'new_follow'
     and read_at is null;
  if (select count(*) from public.notifications
       where recipient_id = '00000000-0000-0000-0000-000000000001'
         and event_type = 'new_follow'
         and read_at is not null) <> 1 then
    raise exception 'FALLO TEST8: marcar leída no aplicó';
  end if;

  -- No puede leer/modificar las de bob.
  select count(*) into v_foreign from public.notifications
   where recipient_id = '00000000-0000-0000-0000-000000000002';
  if v_foreign = 0 then
    raise exception 'FALLO TEST8 setup: bob debería tener notificaciones propias';
  end if;
  update public.notifications
     set read_at = now()
   where recipient_id = '00000000-0000-0000-0000-000000000002';
  if (select count(*) from public.notifications
       where recipient_id = '00000000-0000-0000-0000-000000000002'
         and read_at is not null) <> 0 then
    raise exception 'FALLO TEST8: alice modificó notificaciones de bob';
  end if;

  -- Unread RPC coherente con lo anterior.
  if public.get_unread_notification_count()
     <> (select count(*)::int from public.notifications
          where recipient_id = '00000000-0000-0000-0000-000000000001'
            and read_at is null) then
    raise exception 'FALLO TEST8: unread RPC desalineada con la tabla';
  end if;

  -- Guarda de inmutabilidad: cambiar recipient/event_type está prohibido.
  begin
    update public.notifications
       set recipient_id = '00000000-0000-0000-0000-000000000002'
     where recipient_id = '00000000-0000-0000-0000-000000000001'
       and read_at is null;
    raise exception 'FALLO TEST8: se cambió el recipient de una notificación';
  exception
    when insufficient_privilege then
      null; -- RLS with_check rechaza el cambio de recipiente
    when others then
      if position('NOTIFICATION_IMMUTABLE' in sqlerrm) = 0
        and sqlstate <> '42501' then
        raise exception 'FALLO TEST8: error inesperado al cambiar recipient: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST8: lecturas propias y unread derivado correctos';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 9: privacidad — anon sin grants (permission denied) en todo el dominio
-- ---------------------------------------------------------------------------
set local role anon;

do $$
declare
  v_probe int;
begin
  begin
    select count(*) into v_probe from public.notifications;
    raise exception 'FALLO TEST9: anon leyó notifications';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise exception 'FALLO TEST9: error inesperado en notifications: %', sqlerrm;
  end;

  begin
    select count(*) into v_probe from public.messages;
    raise exception 'FALLO TEST9: anon leyó messages';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise exception 'FALLO TEST9: error inesperado en messages: %', sqlerrm;
  end;

  begin
    select count(*) into v_probe from public.conversations;
    raise exception 'FALLO TEST9: anon leyó conversations';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise exception 'FALLO TEST9: error inesperado en conversations: %', sqlerrm;
  end;

  begin
    select count(*) into v_probe from public.conversation_members;
    raise exception 'FALLO TEST9: anon leyó conversation_members';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise exception 'FALLO TEST9: error inesperado en conversation_members: %', sqlerrm;
  end;
  raise notice 'PASS TEST9: anon sin privilegios de lectura (fail-closed)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 10: retención oportunista del outbox (30 días, sin cron)
-- ---------------------------------------------------------------------------
set local role postgres;
reset role;

do $$
declare
  v_old uuid;
begin
  insert into public.interaction_events (event_type, actor_id, payload, created_at, processed_at)
  values ('reaction_received', '00000000-0000-0000-0000-000000000002',
          '{}'::jsonb, now() - interval '40 days', now())
  returning id into v_old;

  perform public.interaction_events_retention();

  if exists (select 1 from public.interaction_events where id = v_old) then
    raise exception 'FALLO TEST10: el evento antiguo procesado no se purgó';
  end if;
  if not exists (select 1 from public.interaction_events
                  where processed_at is not null
                    and created_at > now() - interval '30 days') then
    raise exception 'FALLO TEST10: la retención borró eventos recientes';
  end if;
  raise notice 'PASS TEST10: retención >30 días aplicada sin cron';
end $$;

rollback;
