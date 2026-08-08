-- ============================================================================
-- FASE 4.1 — Verificación de invariantes (entidad genérica `posts`)
-- ============================================================================
-- Script SQL que comprueba los comportamientos exigidos por la migración
-- 20260809000000_fase4_posts.sql:
--   1. Un vídeo publicado genera EXACTAMENTE un post (backfill/trigger idempotente).
--   2. Un vídeo borrador no genera post; la publicación repetida no duplica.
--   3. El ciclo de vida del vídeo se refleja en el post (hidden/removed/archived
--      dejan de distribuirse; re-publicar lo restaura sin duplicar).
--   4. Matriz de visibilidad anónima: SOLO public visible; unlisted NO es
--      enumerable por anónimos; registered_users, project_members y private NO.
--   5. registered_users: visible para cualquier usuario autenticado.
--   6. project_members: visible SOLO para miembros del proyecto asociado.
--   7. private: visible solo para el autor (y el admin).
--   8. El admin lee todos los posts (private, ajenos, project_members, ...).
--   9. El usuario solo crea posts propios; no puede enlazar vídeos ajenos, ni
--      crear un segundo post para el mismo vídeo, ni posts 'video' sin vídeo o
--      con body (constraints).
--  10. El vínculo post↔vídeo y el autor son inmutables (triggers + RLS).
--  11. No existe DELETE sobre posts (ni privilegio ni política).
--  12. La moderación post-publicación se propaga al post: rechazar (12) o marcar
--      (12b) el vídeo lo retira de la distribución de inmediato; aprobar lo
--      restaura, sin borrar ni re-crear el post.
--  13. El post de vídeo no puede desincronizarse de su contenido: el autor del
--      post debe ser el propietario del vídeo y project_id/organization_id deben
--      coincidir con los del vídeo (TEST 9b).
--  14. El predicado post_is_publicly_distributable es fail-closed (coherencia de
--      visibilidad post↔vídeo y estados no publicados nunca distribuyen).
--  15. Posts sin vídeo (tipos futuros): un anónimo SOLO enumera visibility='public'
--      aunque el post esté publicado; unlisted/registered_users/project_members/
--      private no son enumerables por anónimos (lo garantiza la RLS, no la app).
--
-- Cómo ejecutarlo (stack LOCAL de Supabase, como postgres, tras aplicar las
-- migraciones 20260731 → 20260809):
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fase4_posts.sql
--
-- Requiere superusuario (postgres) para `set local role` y para fijar
-- `request.jwt.claims`. NO ejecutar contra la base remota. Todo el script va en
-- una transacción que se REVIERTE al final: no deja datos ni cambios.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Setup: identidades y datos de prueba (como postgres, RLS omitido)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, username, full_name)
values
  ('00000000-0000-0000-0000-000000000001', 'owner', 'Owner'),
  ('00000000-0000-0000-0000-000000000002', 'other', 'Other'),
  ('00000000-0000-0000-0000-000000000003', 'admin', 'Admin'),
  ('00000000-0000-0000-0000-000000000004', 'outsider', 'Outsider');

-- P1: lo crea 'owner' (el trigger projects_add_owner_member añade al owner como
-- miembro); 'other' se añade como miembro. 'outsider' y 'admin' NO son miembros.
insert into public.projects (id, owner_id, slug, name, stage, status, is_public)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'proyecto-prueba', 'Proyecto de prueba', 'idea', 'published', true);

insert into public.project_members (project_id, profile_id, role)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'contributor');

-- Vídeos: se crean SOLO como draft/uploading/unreviewed (trigger) y luego se
-- publican (update). Bucket obligatorio según la clase de visibilidad.
insert into public.videos (id, owner_id, storage_bucket, storage_path, mime_type, size_bytes, visibility, title, project_id, processing_status, moderation_status, status)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'public-videos',  '00000000-0000-0000-0000-000000000001/v1/video.mp4', 'video/mp4', 1000, 'public',            'Público',            null, 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'public-videos',  '00000000-0000-0000-0000-000000000001/v2/video.mp4', 'video/mp4', 1000, 'unlisted',          'Unlisted',           null, 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'private-videos', '00000000-0000-0000-0000-000000000001/v3/video.mp4', 'video/mp4', 1000, 'registered_users', 'Registrados',        null, 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'private-videos', '00000000-0000-0000-0000-000000000001/v4/video.mp4', 'video/mp4', 1000, 'project_members',  'Miembros de proyecto', '20000000-0000-0000-0000-000000000001', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'private-videos', '00000000-0000-0000-0000-000000000001/v5/video.mp4', 'video/mp4', 1000, 'private',           'Privado',            null, 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'public-videos',  '00000000-0000-0000-0000-000000000002/v6/video.mp4', 'video/mp4', 1000, 'public',            'Público ajeno',      null, 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'public-videos',  '00000000-0000-0000-0000-000000000001/v7/video.mp4', 'video/mp4', 1000, 'public',            'Nunca publicado',    null, 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'public-videos',  '00000000-0000-0000-0000-000000000001/v8/video.mp4', 'video/mp4', 1000, 'public',            'A moderar',          null, 'uploading', 'unreviewed', 'draft');

-- Se publican todos salvo v7 (que debe seguir sin post). El trigger
-- posts_sync_from_video crea un post por cada vídeo publicado.
update public.videos set status = 'published', processing_status = 'ready'
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000008');

-- ---------------------------------------------------------------------------
-- TEST 1: un vídeo publicado ⇒ exactamente un post sincronizado
-- ---------------------------------------------------------------------------
do $$
begin
  if (select count(*) from public.posts) <> 7 then
    raise exception 'FALLO TEST1: el backfill/trigger no mantiene un post por cada vídeo publicado';
  end if;
  if not exists (
    select 1 from public.posts
    where video_id = '10000000-0000-0000-0000-000000000001'
      and author_id = '00000000-0000-0000-0000-000000000001'
      and post_type = 'video'
      and visibility = 'public'
      and publication_status = 'published'
      and published_at is not null
  ) then
    raise exception 'FALLO TEST1: el post no se sincroniza con el vídeo publicado';
  end if;
  raise notice 'PASS TEST1: un vídeo publicado ⇒ exactamente un post sincronizado';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 2: un borrador no genera post y la publicación repetida es idempotente
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000007') then
    raise exception 'FALLO TEST2: un vídeo no publicado generó un post';
  end if;
  raise notice 'PASS TEST2: un vídeo borrador no genera post';
end $$;

update public.videos set title = 'Título actualizado' where id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  if (select count(*) from public.posts where video_id = '10000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALLO TEST2: actualizar/publicar repetidamente duplicó el post';
  end if;
  raise notice 'PASS TEST2: la publicación repetida es idempotente (no duplica post)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 3: el ciclo de vida del vídeo se refleja en su post
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

-- ocultar ⇒ post 'hidden' sin published_at
update public.videos set status = 'hidden' where id = '10000000-0000-0000-0000-000000000002';
do $$
begin
  if not exists (
    select 1 from public.posts
    where video_id = '10000000-0000-0000-0000-000000000002'
      and publication_status = 'hidden'
      and published_at is null
  ) then
    raise exception 'FALLO TEST3: al ocultar el vídeo el post no pasa a hidden';
  end if;
  raise notice 'PASS TEST3: ocultar el vídeo ⇒ post hidden sin published_at';
end $$;

-- retirar ⇒ post 'removed'
update public.videos set status = 'removed' where id = '10000000-0000-0000-0000-000000000002';
do $$
begin
  if not exists (
    select 1 from public.posts
    where video_id = '10000000-0000-0000-0000-000000000002'
      and publication_status = 'removed'
  ) then
    raise exception 'FALLO TEST3: al retirar el vídeo el post no pasa a removed';
  end if;
  raise notice 'PASS TEST3: retirar el vídeo ⇒ post removed';
end $$;

-- un post retirado deja de ser visible para anónimos
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000002') then
    raise exception 'FALLO TEST3: un post retirado es visible para anónimos';
  end if;
  raise notice 'PASS TEST3: el post retirado deja de distribuirse';
end $$;

-- re-publicar ⇒ el post vuelve a 'published' sin duplicarse
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

update public.videos set status = 'published' where id = '10000000-0000-0000-0000-000000000002';
do $$
begin
  if not exists (
    select 1 from public.posts
    where video_id = '10000000-0000-0000-0000-000000000002'
      and publication_status = 'published'
      and published_at is not null
  ) then
    raise exception 'FALLO TEST3: re-publicar no restauró el post';
  end if;
  if (select count(*) from public.posts where video_id = '10000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'FALLO TEST3: re-publicar duplicó el post';
  end if;
  raise notice 'PASS TEST3: re-publicar restaura el post sin duplicarlo';
end $$;

-- archivar ⇒ post 'hidden'
update public.videos set status = 'archived' where id = '10000000-0000-0000-0000-000000000002';
do $$
begin
  if not exists (
    select 1 from public.posts
    where video_id = '10000000-0000-0000-0000-000000000002'
      and publication_status = 'hidden'
  ) then
    raise exception 'FALLO TEST3: al archivar el vídeo el post no pasa a hidden';
  end if;
  raise notice 'PASS TEST3: archivar el vídeo ⇒ post hidden';
end $$;

-- se restaura para los tests posteriores de visibilidad
update public.videos set status = 'published' where id = '10000000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- TEST 4: matriz de visibilidad para anónimos
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000001') then
    raise exception 'FALLO TEST4: un post público publicado no es visible';
  end if;
  if exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000002') then
    raise exception 'FALLO TEST4: un post unlisted es enumerable por anónimos';
  end if;
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000006') then
    raise exception 'FALLO TEST4: un post público ajeno no es visible';
  end if;
  if exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000003') then
    raise exception 'FALLO TEST4: un post registered_users es visible para anónimos';
  end if;
  if exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000004') then
    raise exception 'FALLO TEST4: un post project_members es visible para anónimos';
  end if;
  if exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000005') then
    raise exception 'FALLO TEST4: un post private es visible para anónimos';
  end if;
  raise notice 'PASS TEST4: matriz de visibilidad para anónimos (solo public; unlisted no es enumerable)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 5: registered_users visible para cualquier usuario autenticado
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000003') then
    raise exception 'FALLO TEST5: registered_users no visible para cualquier autenticado';
  end if;
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000006') then
    raise exception 'FALLO TEST5: un post público ajeno no es visible';
  end if;
  raise notice 'PASS TEST5: registered_users visible para cualquier usuario autenticado';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 6: project_members visible SOLO para miembros del proyecto
-- ---------------------------------------------------------------------------
-- 'outsider' NO es miembro: no debe ver el post project_members.
do $$
begin
  if exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000004') then
    raise exception 'FALLO TEST6: project_members visible para un no-miembro';
  end if;
  raise notice 'PASS TEST6: un no-miembro no ve los posts project_members';
end $$;

-- 'other' ES miembro de P1: debe verlo.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000004') then
    raise exception 'FALLO TEST6: project_members no visible para un miembro del proyecto';
  end if;
  raise notice 'PASS TEST6: los miembros del proyecto ven los posts project_members';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 7: private visible solo para el autor
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000005') then
    raise exception 'FALLO TEST7: el autor no ve su propio post private';
  end if;
  raise notice 'PASS TEST7: el autor ve su post private';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 8: el admin lee todos los posts
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

do $$
begin
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000005') then
    raise exception 'FALLO TEST8: el admin no ve un post private ajeno';
  end if;
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000006') then
    raise exception 'FALLO TEST8: el admin no ve un post de otro usuario';
  end if;
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000004') then
    raise exception 'FALLO TEST8: el admin no ve un post project_members';
  end if;
  raise notice 'PASS TEST8: el admin lee todos los posts';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 9: el usuario solo crea posts propios; constraints de tipo y cuerpo
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

-- Post de texto propio: permitido.
do $$
declare new_id uuid;
begin
  insert into public.posts (author_id, post_type, body)
  values ('00000000-0000-0000-0000-000000000001', 'text', 'Hola comunidad')
  returning id into new_id;
  if new_id is null then
    raise exception 'FALLO TEST9: no pudo crear su propio post de texto';
  end if;
  raise notice 'PASS TEST9: el autor puede crear sus propios posts';
end $$;

-- No puede enlazar un vídeo de otro usuario (RLS + trigger de ownership).
do $$
begin
  begin
    insert into public.posts (author_id, post_type, video_id)
    values ('00000000-0000-0000-0000-000000000001', 'video', '10000000-0000-0000-0000-000000000006');
    raise exception 'FALLO TEST9: pudo publicar el vídeo de otro usuario a través de un post';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise notice 'PASS TEST9: no se puede enlazar el vídeo de otro en un post';
  end;
end $$;

-- No puede crear un segundo post para el mismo vídeo (UNIQUE video_id).
do $$
begin
  begin
    insert into public.posts (author_id, post_type, video_id)
    values ('00000000-0000-0000-0000-000000000001', 'video', '10000000-0000-0000-0000-000000000001');
    raise exception 'FALLO TEST9: se creó un segundo post para el mismo vídeo';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise notice 'PASS TEST9: UNIQUE(video_id) impide un segundo post por vídeo';
  end;
end $$;

-- Un post de tipo 'video' exige video_id.
do $$
begin
  begin
    insert into public.posts (author_id, post_type)
    values ('00000000-0000-0000-0000-000000000001', 'video');
    raise exception 'FALLO TEST9: un post de tipo video sin vídeo fue aceptado';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise notice 'PASS TEST9: un post de tipo video exige video_id';
  end;
end $$;

-- Un post de tipo 'video' no admite body (el contenido vive en el vídeo).
do $$
begin
  begin
    insert into public.posts (author_id, post_type, video_id, body)
    values ('00000000-0000-0000-0000-000000000001', 'video', '10000000-0000-0000-0000-000000000007', 'no permitido');
    raise exception 'FALLO TEST9: un post de video aceptó body';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise notice 'PASS TEST9: un post de video no admite body';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TEST 10: el vínculo post↔vídeo y el autor son inmutables
-- ---------------------------------------------------------------------------
-- Trigger posts_prevent_video_change: no se puede re-apuntar el post.
reset role;

do $$
begin
  begin
    update public.posts
    set video_id = '10000000-0000-0000-0000-000000000006'
    where video_id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALLO TEST10: se pudo cambiar el vídeo de un post';
  exception
    when others then
      if sqlerrm like '%FALLO TEST10%' then raise; end if;
      raise notice 'PASS TEST10: no se puede re-apuntar un post a otro vídeo';
  end;
end $$;

-- RLS: el autor no puede cederse el post a otro usuario.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  begin
    update public.posts
    set author_id = '00000000-0000-0000-0000-000000000002'
    where video_id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALLO TEST10: se pudo cambiar el autor de un post';
  exception
    when others then
      if sqlerrm like '%FALLO TEST10%' then raise; end if;
      raise notice 'PASS TEST10: no se puede cambiar el autor de un post';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TEST 11: no existe DELETE sobre posts (ni privilegio ni política)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    delete from public.posts where video_id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALLO TEST11: un usuario pudo borrar un post';
  exception
    when others then
      if sqlerrm like '%FALLO TEST11%' then raise; end if;
      raise notice 'PASS TEST11: los posts no se pueden borrar';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TEST 12: la moderación post-publicación se propaga al post
-- ---------------------------------------------------------------------------
-- Prueba del trigger durante la moderación: el ADMIN B modera el vídeo de OTRO
-- usuario (A) mediante funciones SECURITY DEFINER de FASE 3 (admin_reject_video
-- / admin_flag_video / admin_approve_video). Dentro de ellas el `update` de
-- `videos` corre como el propietario de la función (postgres), que omite RLS:
-- el trigger posts_sync_from_video se dispara y su INSERT ... ON CONFLICT
-- (video_id) DO UPDATE sobre `posts` NO evalúa posts_update_own (auth.uid() del
-- admin ≠ author_id del post). La moderación siempre se completa, el post
-- conserva su mismo id y no se duplica; la distribución la bloquea el predicado.
reset role;

create temporary table if not exists _post_v8 (id uuid);
truncate _post_v8;
insert into _post_v8 select id from public.posts where video_id = '10000000-0000-0000-0000-000000000008';

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

-- El admin rechaza el vídeo v8: su post deja de distribuirse de inmediato.
select public.admin_reject_video('10000000-0000-0000-0000-000000000008', 'contenido no permitido');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000008') then
    raise exception 'FALLO TEST12: el post de un vídeo rechazado sigue distribuyéndose';
  end if;
  raise notice 'PASS TEST12: rechazar el vídeo retira su post de la distribución';
end $$;

-- El post se conserva y el autor lo sigue viendo (no se borra ni se re-crea).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if not exists (
    select 1 from public.posts
    where video_id = '10000000-0000-0000-0000-000000000008'
      and publication_status = 'published'
  ) then
    raise exception 'FALLO TEST12: el post de un vídeo rechazado no se conserva';
  end if;
  if (select count(*) from public.posts where video_id = '10000000-0000-0000-0000-000000000008') <> 1 then
    raise exception 'FALLO TEST12: la moderación duplicó el post';
  end if;
  if not exists (
    select 1 from public.posts p, _post_v8 c
    where p.video_id = '10000000-0000-0000-0000-000000000008' and p.id = c.id
  ) then
    raise exception 'FALLO TEST12: la moderación cambió el id del post';
  end if;
  raise notice 'PASS TEST12: el post rechazado se conserva (mismo id, sin duplicar) y el autor lo ve';
end $$;

-- Aprobar el vídeo restaura la distribución del post sin re-publicar.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select public.admin_approve_video('10000000-0000-0000-0000-000000000008');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000008') then
    raise exception 'FALLO TEST12: aprobar el vídeo no restauró la distribución del post';
  end if;
  if (select count(*) from public.posts where video_id = '10000000-0000-0000-0000-000000000008') <> 1 then
    raise exception 'FALLO TEST12: aprobar duplicó el post';
  end if;
  if not exists (
    select 1 from public.posts p, _post_v8 c
    where p.video_id = '10000000-0000-0000-0000-000000000008' and p.id = c.id
  ) then
    raise exception 'FALLO TEST12: aprobar cambió el id del post';
  end if;
  raise notice 'PASS TEST12: aprobar el vídeo restaura la distribución sin crear otro post';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 12b: la marca (flagged) también retira el post de la distribución
-- ---------------------------------------------------------------------------
-- El admin marca el vídeo v8: su post deja de distribuirse de inmediato y un
-- approve posterior lo restaura sin borrar ni re-crear el post.
reset role;
truncate _post_v8;
insert into _post_v8 select id from public.posts where video_id = '10000000-0000-0000-0000-000000000008';

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select public.admin_flag_video('10000000-0000-0000-0000-000000000008', 'marca temporal');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000008') then
    raise exception 'FALLO TEST12b: el post de un vídeo marcado sigue distribuyéndose';
  end if;
  raise notice 'PASS TEST12b: marcar el vídeo retira su post de la distribución';
end $$;

-- El post se conserva y el autor lo sigue viendo (no se borra ni se re-crea).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if not exists (
    select 1 from public.posts
    where video_id = '10000000-0000-0000-0000-000000000008'
      and publication_status = 'published'
  ) then
    raise exception 'FALLO TEST12b: el post de un vídeo marcado no se conserva';
  end if;
  if (select count(*) from public.posts where video_id = '10000000-0000-0000-0000-000000000008') <> 1 then
    raise exception 'FALLO TEST12b: la moderación duplicó el post';
  end if;
  if not exists (
    select 1 from public.posts p, _post_v8 c
    where p.video_id = '10000000-0000-0000-0000-000000000008' and p.id = c.id
  ) then
    raise exception 'FALLO TEST12b: la moderación cambió el id del post';
  end if;
  raise notice 'PASS TEST12b: el post marcado se conserva (mismo id, sin duplicar) y el autor lo ve';
end $$;

-- Aprobar el vídeo marcado restaura la distribución del post sin re-publicar.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select public.admin_approve_video('10000000-0000-0000-0000-000000000008');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if not exists (select 1 from public.posts where video_id = '10000000-0000-0000-0000-000000000008') then
    raise exception 'FALLO TEST12b: aprobar el vídeo marcado no restauró la distribución del post';
  end if;
  if (select count(*) from public.posts where video_id = '10000000-0000-0000-0000-000000000008') <> 1 then
    raise exception 'FALLO TEST12b: aprobar duplicó el post';
  end if;
  if not exists (
    select 1 from public.posts p, _post_v8 c
    where p.video_id = '10000000-0000-0000-0000-000000000008' and p.id = c.id
  ) then
    raise exception 'FALLO TEST12b: aprobar cambió el id del post';
  end if;
  raise notice 'PASS TEST12b: aprobar el vídeo marcado restaura la distribución sin crear otro post';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 9b: el post de vídeo no puede desincronizarse de su contenido
-- (project_id/organization_id deben coincidir con los del vídeo).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

-- El propietario del vídeo v1 (sin proyecto) no puede asociarlo a un proyecto.
do $$
begin
  begin
    insert into public.posts (author_id, post_type, video_id, project_id)
    values ('00000000-0000-0000-0000-000000000001', 'video', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
    raise exception 'FALLO TEST9b: un post de vídeo se asoció a un proyecto distinto del vídeo';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9b%' then raise; end if;
      raise notice 'PASS TEST9b: el post de vídeo hereda obligatoriamente el proyecto del vídeo';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TEST 13: el predicado de distributividad es fail-closed
-- ---------------------------------------------------------------------------
do $$
begin
  if not public.post_is_publicly_distributable('published', 'public', '10000000-0000-0000-0000-000000000001') then
    raise exception 'FALLO TEST13: no reconoce un post público publicado distribuible';
  end if;
  if not public.post_is_publicly_distributable('published', 'unlisted', '10000000-0000-0000-0000-000000000002') then
    raise exception 'FALLO TEST13: no reconoce un post unlisted publicado distribuible';
  end if;
  if public.post_is_publicly_distributable('published', 'public', '10000000-0000-0000-0000-000000000002') then
    raise exception 'FALLO TEST13: no detecta la divergencia de visibilidad post↔vídeo (fail-closed)';
  end if;
  if public.post_is_publicly_distributable('draft', 'public', '10000000-0000-0000-0000-000000000001') then
    raise exception 'FALLO TEST13: un post borrador es distribuible';
  end if;
  if not public.post_is_publicly_distributable('published', 'public', null) then
    raise exception 'FALLO TEST13: un post de texto publicado no es distribuible';
  end if;
  if public.post_is_publicly_distributable('draft', 'public', null) then
    raise exception 'FALLO TEST13: un post de texto borrador es distribuible';
  end if;
  raise notice 'PASS TEST13: el predicado de distributividad es fail-closed';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 15: posts SIN vídeo (tipos futuros) — matriz de lectura para anónimos
-- ---------------------------------------------------------------------------
-- Se crean posts de tipo 'text' ya publicados con cada visibilidad. Aunque aún
-- no exista UI para crearlos, la RLS debe impedir su enumeración pública salvo
-- visibility='public': la exposición nunca puede depender de filtros de la app.
reset role;

insert into public.posts (author_id, post_type, body, visibility, publication_status, published_at)
values
  ('00000000-0000-0000-0000-000000000001', 'text', 'Texto público',         'public',           'published', now()),
  ('00000000-0000-0000-0000-000000000001', 'text', 'Texto unlisted',        'unlisted',         'published', now()),
  ('00000000-0000-0000-0000-000000000001', 'text', 'Texto registrados',     'registered_users', 'published', now()),
  ('00000000-0000-0000-0000-000000000001', 'text', 'Texto de miembros',     'project_members',  'published', now()),
  ('00000000-0000-0000-0000-000000000001', 'text', 'Texto privado',         'private',          'published', now());

-- Anónimo: solo ve el post de texto 'public' (ni unlisted ni el resto).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if (select count(*) from public.posts where post_type = 'text' and visibility = 'public') <> 1 then
    raise exception 'FALLO TEST15: un anónimo no ve el post de texto público';
  end if;
  if exists (
    select 1 from public.posts
    where post_type = 'text' and visibility in ('unlisted', 'registered_users', 'project_members', 'private')
  ) then
    raise exception 'FALLO TEST15: un anónimo enumeró posts de texto no públicos';
  end if;
  raise notice 'PASS TEST15: un anónimo solo enumera posts sin vídeo con visibility public';
end $$;

-- Los tiers superiores SÍ se sirven a quien corresponde (no quedan bloqueados).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if not exists (select 1 from public.posts where post_type = 'text' and visibility = 'registered_users') then
    raise exception 'FALLO TEST15: un autenticado no ve el post registered_users';
  end if;
  if exists (select 1 from public.posts where post_type = 'text' and visibility = 'project_members') then
    raise exception 'FALLO TEST15: un no-miembro ve el post project_members';
  end if;
  if exists (select 1 from public.posts where post_type = 'text' and visibility = 'private') then
    raise exception 'FALLO TEST15: un autenticado no-propietario ve el post private';
  end if;
  raise notice 'PASS TEST15: registered_users visible para autenticados; project_members/private no';
end $$;

-- ---------------------------------------------------------------------------
-- Limpieza: nada de lo anterior persiste.
-- ---------------------------------------------------------------------------
raise notice 'TODOS LOS TESTS DE FASE 4.1 (POSTS) PASARON';
rollback;
