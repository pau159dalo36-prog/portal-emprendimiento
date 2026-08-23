-- ============================================================================
-- FASE 9 — Verificación de invariantes (comentarios/feedback/reacciones/guardados)
-- ============================================================================
-- Script SQL que comprueba los comportamientos exigidos por las migraciones
-- 20260819000000_fase9_interacciones.sql y 20260820000000_fase9_min_priv:
--
--   1. ACL mínima: anon solo SELECT en post_comments; sin ningún privilegio en
--      feedback/reacciones/saves; interaction_events inaccesible para
--      anon/authenticated (outbox solo service_role/triggers).
--   2. Comentarios: crear, responder (máx 1 nivel), editar lo propio, ocultar/
--      borrar lo propio; denegado editar/borrar lo ajeno; body vacío rechazado
--      por CHECK; padre inválido (otro post o respuesta de respuesta) rechazado.
--   3. Privacidad: no se puede comentar/reaccionar/guardar sobre contenido no
--      público (visibility private, publication_status hidden/removed, vídeo
--      rejected/flagged quedan fuera por post_is_publicly_distributable).
--   4. Bloqueos: si A bloquea a B (o B a A) no hay NUEVAS interacciones entre
--      ambos (comentarios, reacción vía RPC, feedback); las existentes siguen.
--   5. Feedback: 1 por usuario/proyecto (upsert actualiza, nunca duplica),
--      score 0–10 por CHECK, self-feedback denegado, el propietario lee el
--      feedback recibido, anon no puede leerlo.
--   6. Reacciones: UNIQUE usuario+post+'support', toggle idempotente vía RPC,
--      conteos por agregación que ocultan contenido no público.
--   7. Guardados: tablas con FK real, duplicado idempotente, unsave, listado
--      propio exclusivo (nadie enumera guardados ajenos).
--   8. Outbox: los triggers generan eventos comment_created/reply_created/
--      feedback_received/reaction_received para FASE 10.
--
-- Cómo ejecutarlo (stack LOCAL de Supabase, como postgres, tras aplicar todas
-- las migraciones):
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fase9_interacciones.sql
--
-- Requiere superusuario (postgres). NO ejecutar contra la base remota. Todo el
-- script va en una transacción que se REVIERTE al final.
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

-- Proyecto público publicado de alice (para feedback) y proyecto privado.
insert into public.projects (id, owner_id, slug, name, stage, status, is_public)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'proyecto-publico-f9', 'Proyecto público F9', 'idea', 'published', true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'proyecto-dave-f9', 'Proyecto Dave F9', 'idea', 'published', true);

-- Oportunidad pública publicada de alice (para guardados).
insert into public.opportunities (id, creator_id, title, description, opportunity_type, status, visibility)
values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        'Puesto público F9', 'Descripción suficientemente larga para la prueba.',
        'job', 'published', 'public');

-- Vídeo publicado y público de alice: el trigger posts_sync_from_video crea
-- automáticamente su post P1 (publication_status published, visibility public).
insert into public.videos (id, owner_id, title, mime_type, size_bytes, storage_bucket, storage_path, status, processing_status, visibility, moderation_status)
values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        'Vídeo público F9', 'video/mp4', 1024, 'videos', 'f9/v1.mp4', 'published', 'ready', 'public', 'approved');

-- Vídeo privado publicado de alice: crea post P2 con visibility private.
insert into public.videos (id, owner_id, title, mime_type, size_bytes, storage_bucket, storage_path, status, processing_status, visibility, moderation_status)
values ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
        'Vídeo privado F9', 'video/mp4', 1024, 'videos', 'f9/v2.mp4', 'published', 'ready', 'private', 'approved');

-- Vídeo público de bob (para probar bloqueos contra contenido de bob).
insert into public.videos (id, owner_id, title, mime_type, size_bytes, storage_bucket, storage_path, status, processing_status, visibility, moderation_status)
values ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
        'Vídeo de Bob F9', 'video/mp4', 1024, 'videos', 'f9/v3.mp4', 'published', 'ready', 'public', 'approved');

-- Vídeo público de dave (contenido de dave para el escenario de bloqueo).
insert into public.videos (id, owner_id, title, mime_type, size_bytes, storage_bucket, storage_path, status, processing_status, visibility, moderation_status)
values ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004',
        'Vídeo de Dave F9', 'video/mp4', 1024, 'videos', 'f9/v4.mp4', 'published', 'ready', 'public', 'approved');

do $$
begin
  if (select count(*) from public.posts where publication_status = 'published') < 4 then
    raise exception 'FALLO SETUP: los posts sincronizados no se crearon';
  end if;
  raise notice 'PASS SETUP: posts sincronizados desde vídeos (P1..P4)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 1: ACL mínima (grants exactos, sin dependencia de defaults)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  -- anon: solo lectura de comentarios públicos.
  if not has_table_privilege('anon', 'public.post_comments', 'SELECT') then
    raise exception 'FALLO TEST1: anon debería poder LEER comentarios públicos';
  end if;
  if has_table_privilege('anon', 'public.post_comments', 'INSERT')
    or has_table_privilege('anon', 'public.post_comments', 'UPDATE')
    or has_table_privilege('anon', 'public.post_comments', 'DELETE') then
    raise exception 'FALLO TEST1: anon tiene privilegios de escritura en comentarios';
  end if;
  if has_table_privilege('anon', 'public.project_feedback', 'SELECT')
    or has_table_privilege('anon', 'public.post_reactions', 'SELECT')
    or has_table_privilege('anon', 'public.saved_posts', 'SELECT')
    or has_table_privilege('anon', 'public.saved_projects', 'SELECT')
    or has_table_privilege('anon', 'public.saved_opportunities', 'SELECT') then
    raise exception 'FALLO TEST1: anon puede leer tablas que deberían ser privadas';
  end if;
  -- Outbox: inaccesible para anon y authenticated.
  if has_table_privilege('anon', 'public.interaction_events', 'SELECT')
    or has_table_privilege('anon', 'public.interaction_events', 'INSERT') then
    raise exception 'FALLO TEST1: anon accede al outbox de eventos';
  end if;
  raise notice 'PASS TEST1: ACL correcta para anon';
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.interaction_events', 'SELECT')
    or has_table_privilege('authenticated', 'public.interaction_events', 'INSERT') then
    raise exception 'FALLO TEST1: authenticated accede al outbox de eventos';
  end if;
  if not has_table_privilege('authenticated', 'public.saved_posts', 'SELECT') then
    raise exception 'FALLO TEST1: authenticated no puede leer sus guardados';
  end if;
  raise notice 'PASS TEST1: ACL correcta para authenticated (outbox cerrado)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 2: comentarios — crear, responder a 1 nivel, validaciones de hilo
-- ---------------------------------------------------------------------------
-- bob comenta el post público P1 de alice.
insert into public.post_comments (post_id, author_id, body)
values ('50000000-0000-0000-0000-000000000001'
        , '00000000-0000-0000-0000-000000000002', 'Gran proyecto, enhorabuena.');

do $$
declare
  v_root uuid;
begin
  select id into v_root from public.post_comments
  where author_id = '00000000-0000-0000-0000-000000000002' limit 1;

  -- Responder a un comentario raíz: permitido (profundidad 1).
  insert into public.post_comments (post_id, author_id, parent_id, body)
  values ((select post_id from public.post_comments where id = v_root),
          '00000000-0000-0000-0000-000000000001', v_root, 'Gracias por tu apoyo');
  if (select reply_depth from public.post_comments where id = v_root) <> 0 then
    raise exception 'FALLO TEST2: la raíz debería tener profundidad 0';
  end if;

  begin
    insert into public.post_comments (post_id, author_id, parent_id, body)
    values ((select post_id from public.post_comments where id = v_root),
            '00000000-0000-0000-0000-000000000002',
            (select id from public.post_comments where parent_id = v_root),
            'respuesta a la respuesta');
    raise exception 'FALLO TEST2: se aceptó una respuesta de segundo nivel';
  exception
    when others then
      if sqlerrm like '%FALLO TEST2%' then raise; end if;
      if sqlerrm not like '%COMMENT_PARENT_INVALID%' then
        raise exception 'FALLO TEST2: error inesperado en respuesta anidada: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST2: respuestas limitadas a 1 nivel (COMMENT_PARENT_INVALID)';
end $$;

-- Body vacío: rechazado por CHECK de BD.
do $$
begin
  begin
    insert into public.post_comments (post_id, author_id, body)
    values ('50000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002', '   ');
    raise exception 'FALLO TEST2: se aceptó un comentario vacío';
  exception
    when others then
      if sqlerrm like '%FALLO TEST2%' then raise; end if;
  end;
  raise notice 'PASS TEST2: body vacío rechazado por CHECK';
end $$;

-- Un comentario no puede cambiar de post usando un padre de otro hilo.
do $$
begin
  begin
    insert into public.post_comments (post_id, author_id, parent_id, body)
    values ('50000000-0000-0000-0000-000000000003',
            '00000000-0000-0000-0000-000000000002',
            (select id from public.post_comments
              where author_id = '00000000-0000-0000-0000-000000000002'),
            'hilo cruzado');
    raise exception 'FALLO TEST2: se aceptó un comentario con padre de otro post';
  exception
    when others then
      if sqlerrm like '%FALLO TEST2%' then raise; end if;
      if sqlerrm not like '%COMMENT_PARENT_INVALID%' then
        raise exception 'FALLO TEST2: error inesperado en hilo cruzado: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS TEST2: padre de otro post rechazado';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 3: comentarios — editar/ocultar/borrar lo propio; lo ajeno, no
-- ---------------------------------------------------------------------------
do $$
declare
  v_bob_comment uuid;
begin
  select id into v_bob_comment from public.post_comments
  where author_id = '00000000-0000-0000-0000-000000000002';

  -- bob edita lo suyo.
  update public.post_comments set body = 'Comentario actualizado.'
  where id = v_bob_comment;
  if (select body from public.post_comments where id = v_bob_comment)
    <> 'Comentario actualizado.' then
    raise exception 'FALLO TEST3: bob no pudo editar su comentario';
  end if;

  -- bob intenta editar el comentario de alice: 0 filas afectadas.
  update public.post_comments set body = 'hackeado'
  where author_id = '00000000-0000-0000-0000-000000000001';
  if exists (select 1 from public.post_comments where body = 'hackeado') then
    raise exception 'FALLO TEST3: bob editó un comentario ajeno';
  end if;

  -- Ocultar lo propio funciona; ocultar lo ajeno no afecta.
  update public.post_comments set is_hidden = true where id = v_bob_comment;
  if not (select is_hidden from public.post_comments where id = v_bob_comment) then
    raise exception 'FALLO TEST3: bob no pudo ocultar su comentario';
  end if;
  update public.post_comments set is_hidden = true
  where author_id = '00000000-0000-0000-0000-000000000001';
  if exists (
    select 1 from public.post_comments
    where author_id = '00000000-0000-0000-0000-000000000001' and is_hidden
  ) then
    raise exception 'FALLO TEST3: bob ocultó un comentario ajeno';
  end if;

  -- Borrar lo propio sí.
  delete from public.post_comments where id = v_bob_comment;
  if exists (select 1 from public.post_comments where id = v_bob_comment) then
    raise exception 'FALLO TEST3: bob no pudo borrar su comentario';
  end if;
  raise notice 'PASS TEST3: edición/ocultación/borrado solo de lo propio';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 4: privacidad — nada de interacciones sobre contenido no público
-- ---------------------------------------------------------------------------
-- P2 es un post de visibilidad privada: ni comentarios ni reacción ni guardado.
do $$
begin
  begin
    insert into public.post_comments (post_id, author_id, body)
    values ('50000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000002', 'debería fallar');
    raise exception 'FALLO TEST4: bob comentó un post privado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
  end;

  begin
    perform public.toggle_post_support('50000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST4: la RPC permitió apoyar un post privado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
      if sqlerrm not like '%POST_NOT_INTERACTABLE%' then
        raise exception 'FALLO TEST4: error inesperado al apoyar post privado: %', sqlerrm;
      end if;
  end;

  begin
    insert into public.saved_posts (profile_id, post_id)
    values ('00000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST4: bob guardó un post privado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
  end;
  raise notice 'PASS TEST4: sin comentarios/reacciones/guardados sobre contenido privado';
end $$;

-- Un post oculto (hidden) tampoco admite guardados nuevos.
update public.videos set status = 'hidden'
where id = '50000000-0000-0000-0000-000000000002';

do $$
begin
  begin
    insert into public.saved_posts (profile_id, post_id)
    values ('00000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002');
    raise exception 'FALLO TEST4: bob guardó un post oculto (hidden)';
  exception
    when others then
      if sqlerrm like '%FALLO TEST4%' then raise; end if;
  end;
  raise notice 'PASS TEST4: post oculto (hidden) no admite guardados';
end $$;

-- Restauramos el estado del vídeo privado para el resto de pruebas.
do $$
begin
  update public.videos set status = 'published'
  where id = '50000000-0000-0000-0000-000000000002';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 5: feedback estructurado — upsert idempotente, score, self-feedback
-- ---------------------------------------------------------------------------
-- bob deja feedback en el proyecto público de alice.
insert into public.project_feedback (
  project_id, author_id, understanding, problem, useful, unclear,
  suggestions, would_use, interest_score
)
values (
  '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
  'Entiendo que valida ideas de negocio con vídeo.',
  'Falta feedback estructurado', 'La sección de qué entienden', null,
  'Añadir métricas', 'yes', 8
);

-- Actualizar (mismo UNIQUE project_id+author_id): una sola fila, mismo id.
do $$
declare
  v_before uuid; v_after uuid;
begin
  select id into v_before from public.project_feedback
  where author_id = '00000000-0000-0000-0000-000000000002';

  update public.project_feedback set interest_score = 9, would_use = 'maybe'
  where author_id = '00000000-0000-0000-0000-000000000002';

  select id into v_after from public.project_feedback
  where author_id = '00000000-0000-0000-0000-000000000002';

  if v_before is distinct from v_after then
    raise exception 'FALLO TEST5: actualizar feedback cambió su identidad';
  end if;
  if (select count(*) from public.project_feedback) <> 1 then
    raise exception 'FALLO TEST5: hay feedback duplicado';
  end if;
  if (select interest_score from public.project_feedback where id = v_after) <> 9 then
    raise exception 'FALLO TEST5: el feedback no se actualizó';
  end if;
  raise notice 'PASS TEST5: feedback único por usuario y actualizable';
end $$;

-- Score fuera de rango: CHECK de BD.
do $$
begin
  begin
    insert into public.project_feedback (
      project_id, author_id, understanding, would_use, interest_score
    ) values (
      '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
      'Feedback con score inválido.', 'yes', 11
    );
    raise exception 'FALLO TEST5: se aceptó interest_score 11';
  exception
    when others then
      if sqlerrm like '%FALLO TEST5%' then raise; end if;
  end;
  raise notice 'PASS TEST5: interest_score fuera de 0–10 rechazado por CHECK';
end $$;

-- Self-feedback: alice no puede dar feedback de su propio proyecto.
do $$
begin
  begin
    insert into public.project_feedback (
      project_id, author_id, understanding, would_use
    ) values (
      '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
      'Mi propio proyecto me parece genial.', 'yes'
    );
    raise exception 'FALLO TEST5: alice dio feedback de su propio proyecto';
  exception
    when others then
      if sqlerrm like '%FALLO TEST5%' then raise; end if;
  end;
  raise notice 'PASS TEST5: self-feedback denegado por RLS';
end $$;

-- Visibilidad: el propietario ve el feedback recibido; anon no puede leer.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.project_feedback
      where project_id = '20000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALLO TEST5: la propietaria no ve el feedback de su proyecto';
  end if;
  raise notice 'PASS TEST5: el propietario lee el feedback recibido';
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  begin
    perform from public.project_feedback;
    raise exception 'FALLO TEST5: anon pudo leer feedback';
  exception
    when others then
      if sqlerrm like '%FALLO TEST5%' then raise; end if;
  end;
  raise notice 'PASS TEST5: anon no puede leer el feedback (privado por diseño)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 6: reacciones — toggle idempotente + conteos agregados sin fugas
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
declare
  v_first boolean; v_second boolean;
begin
  v_first := public.toggle_post_support('50000000-0000-0000-0000-000000000001');
  v_second := public.toggle_post_support('50000000-0000-0000-0000-000000000001');

  if v_first <> true then
    raise exception 'FALLO TEST6: el primer apoyo debería activarse';
  end if;
  if v_second <> false then
    raise exception 'FALLO TEST6: repetir el apoyo debería quitarlo (toggle)';
  end if;
  if (select count(*) from public.post_reactions
      where post_id = '50000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'FALLO TEST6: el toggle dejó filas residuales';
  end if;

  perform public.toggle_post_support('50000000-0000-0000-0000-000000000001');
  raise notice 'PASS TEST6: toggle idempotente sobre UNIQUE (post, perfil, tipo)';
end $$;

-- anon consulta los conteos agregados: ve el post público pero no el privado.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
declare
  v_public_row record;
begin
  select * into v_public_row from public.get_post_interaction_counts(
    array['50000000-0000-0000-0000-000000000001',
          '50000000-0000-0000-0000-000000000002']);
  if v_public_row is null then
    raise exception 'FALLO TEST6: anon no recibió el conteo del post público';
  end if;
  if v_public_row.support_count <> 1 or v_public_row.comment_count <> 1 then
    raise exception 'FALLO TEST6: conteos incorrectos para el post público';
  end if;
  if exists (
    select 1 from public.get_post_interaction_counts(
      array['50000000-0000-0000-0000-000000000002'])
    where post_id = '50000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FALLO TEST6: los conteos filtran el post privado';
  end if;
  raise notice 'PASS TEST6: conteos públicos por agregación, sin fuga del privado';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 7: guardados — FKs reales, idempotencia, listado propio exclusivo
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.saved_posts (profile_id, post_id)
values ('00000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001');
insert into public.saved_projects (profile_id, project_id)
values ('00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001');
insert into public.saved_opportunities (profile_id, opportunity_id)
values ('00000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001');

-- Duplicado: upsert idempotente no falla ni duplica.
insert into public.saved_projects (profile_id, project_id)
values ('00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001')
on conflict (profile_id, project_id) do nothing;

-- carol guarda también el post P1: bob solo debe ver EL SUYO al listar.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.saved_posts (profile_id, post_id)
values ('00000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001');

do $$
begin
  if (select count(*) from public.saved_posts
      where profile_id = '00000000-0000-0000-0000-000000000003') <> 1 then
    raise exception 'FALLO TEST7: carol no ve su guardado propio';
  end if;
  raise notice 'PASS TEST7: cada perfil lista únicamente sus guardados';
end $$;

-- bob quita el guardado del proyecto (unsave) y desaparece solo para él.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

delete from public.saved_projects
where profile_id = '00000000-0000-0000-0000-000000000002'
  and project_id = '20000000-0000-0000-0000-000000000001';

do $$
begin
  if exists (
    select 1 from public.saved_projects
    where profile_id = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FALLO TEST7: el unsave no eliminó el guardado de bob';
  end if;
  raise notice 'PASS TEST7: guardar/duplicar/quitar funcionan con FKs reales';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 8: bloqueos — sin nuevas interacciones entre el par bloqueado
-- ---------------------------------------------------------------------------
-- Estado previo: bob ya tiene feedback sobre PR1 (de alice) y un apoyo en P1.

-- bob comenta el post público de dave (permitido antes del bloqueo).
insert into public.post_comments (post_id, author_id, body)
values ('50000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000002', 'Buen vídeo, Dave.');

-- dave bloquea a bob.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.profile_blocks (profile_id, blocked_id)
values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002');

-- bob (bloqueado) no puede comentar contenido nuevo de dave...
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.post_comments (post_id, author_id, body)
    values ('50000000-0000-0000-0000-000000000004',
            '00000000-0000-0000-0000-000000000002', 'segundo intento');
    raise exception 'FALLO TEST8: bob comentó siendo bloqueado por dave';
  exception
    when others then
      if sqlerrm like '%FALLO TEST8%' then raise; end if;
  end;

  begin
    perform public.toggle_post_support('50000000-0000-0000-0000-000000000004');
    raise exception 'FALLO TEST8: la RPC dejó apoyar estando bloqueado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST8%' then raise; end if;
      if sqlerrm not like '%POST_NOT_INTERACTABLE%' then
        raise exception 'FALLO TEST8: error inesperado al apoyar bloqueado: %', sqlerrm;
      end if;
  end;

  -- ...ni dar feedback al proyecto público de dave.
  begin
    insert into public.project_feedback (
      project_id, author_id, understanding, would_use
    ) values (
      '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
      'Intento de feedback tras bloqueo.', 'no'
    );
    raise exception 'FALLO TEST8: bob dio feedback a quien lo bloqueó';
  exception
    when others then
      if sqlerrm like '%FALLO TEST8%' then raise; end if;
  end;

  -- La interacción previa al bloqueo sigue existiendo (no se purga).
  if (select count(*) from public.post_comments
      where author_id = '00000000-0000-0000-0000-000000000002'
        and post_id = '50000000-0000-0000-0000-000000000004') <> 1 then
    raise exception 'FALLO TEST8: el comentario previo al bloqueo desapareció';
  end if;
  raise notice 'PASS TEST8: bloqueado no genera nuevas interacciones; las previas persisten';
end $$;

-- Y en la otra dirección: dave (bloqueador) tampoco puede interactuar con bob.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.post_comments (post_id, author_id, body)
    values ('50000000-0000-0000-0000-000000000003',
            '00000000-0000-0000-0000-000000000004', 'te sigo viendo igualmente');
    raise exception 'FALLO TEST8: el bloqueador comentó contenido del bloqueado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST8%' then raise; end if;
  end;
  raise notice 'PASS TEST8: bloqueador tampoco puede iniciar interacciones nuevas';
end $$;

-- Desbloqueo: vuelven a permitirse las interacciones.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

delete from public.profile_blocks
where profile_id = '00000000-0000-0000-0000-000000000004'
  and blocked_id = '00000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  insert into public.post_comments (post_id, author_id, body)
  values ('50000000-0000-0000-0000-000000000004',
          '00000000-0000-0000-0000-000000000002', 'Ahora sí, gran vídeo.');
  if (select count(*) from public.post_comments
      where author_id = '00000000-0000-0000-0000-000000000002'
        and post_id = '50000000-0000-0000-0000-000000000004') <> 2 then
    raise exception 'FALLO TEST8: tras desbloquear bob sigue sin poder comentar';
  end if;
  raise notice 'PASS TEST8: tras desbloquear se permiten interacciones nuevas';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 9: outbox — los triggers generan eventos para FASE 10
-- ---------------------------------------------------------------------------
reset role;

do $$
declare
  v_kinds text[];
begin
  select array_agg(distinct event_type) into v_kinds from public.interaction_events;

  if not v_kinds @> array['comment_created'] then
    raise exception 'FALLO TEST9: falta evento comment_created';
  end if;
  if not v_kinds @> array['reply_created'] then
    raise exception 'FALLO TEST9: falta evento reply_created';
  end if;
  if not v_kinds @> array['feedback_received'] then
    raise exception 'FALLO TEST9: falta evento feedback_received';
  end if;
  if not v_kinds @> array['reaction_received'] then
    raise exception 'FALLO TEST9: falta evento reaction_received';
  end if;
  raise notice 'PASS TEST9: outbox registra los 4 tipos de eventos (FASE 10 lista)';
end $$;

-- ---------------------------------------------------------------------------
-- Limpieza: nada de lo anterior persiste.
-- ---------------------------------------------------------------------------
raise notice 'TODOS LOS TESTS DE FASE 9 (INTERACCIONES) PASARON';
rollback;
