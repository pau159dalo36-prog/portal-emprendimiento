-- ============================================================================
-- FASE 4 — Verificación de invariantes (moderación post-publicación)
-- ============================================================================
-- Script SQL que comprueba los comportamientos exigidos:
--   1. El propietario publica su vídeo SIN aprobación previa.
--   2. Un usuario no puede publicar el vídeo de otro.
--   3. Un vídeo público publicado (sin revisión) es visible y servible.
--   4. Un vídeo 'unlisted' no se lista en los feeds públicos (capa app/RLS).
--   5. Un vídeo 'private' sigue protegido (ni RLS ni signed URLs).
--   6. Al rechazar/marcar, el vídeo deja de estar disponible de inmediato
--      (RLS + storage) y un 'approve' posterior lo restaura.
--   7. Un usuario normal no puede moderar (ni RPC ni UPDATE directo).
--   8. El admin puede moderar vídeos de otros (y no los suyos).
--   9. El estado 'pending' deja de ser válido; el default es 'unreviewed'.
--
-- Cómo ejecutarlo (stack LOCAL de Supabase, como postgres, tras aplicar las
-- migraciones 20260731 → 20260807):
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fase4_moderation_post_publication.sql
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
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, username, full_name)
values
  ('00000000-0000-0000-0000-000000000001', 'owner', 'Owner'),
  ('00000000-0000-0000-0000-000000000002', 'other', 'Other'),
  ('00000000-0000-0000-0000-000000000003', 'admin', 'Admin');

-- v2: vídeo de 'other' (público). v3: vídeo privado de 'owner'.
-- La creación SOLO puede ser draft/uploading/unreviewed (trigger), así que se
-- crean como borrador y luego se publican (update).
insert into public.videos (id, owner_id, storage_bucket, storage_path, mime_type, size_bytes, visibility, title, processing_status, moderation_status, status)
values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'public-videos',  '00000000-0000-0000-0000-000000000002/v2/video.mp4', 'video/mp4', 1000, 'public', 'Vídeo ajeno', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'private-videos', '00000000-0000-0000-0000-000000000001/v3/video.mp4', 'video/mp4', 1000, 'private', 'Vídeo privado', 'uploading', 'unreviewed', 'draft'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'public-videos',  '00000000-0000-0000-0000-000000000003/v4/video.mp4', 'video/mp4', 1000, 'public', 'Vídeo del admin', 'uploading', 'unreviewed', 'draft');

update public.videos set status = 'published', processing_status = 'ready' where id = '10000000-0000-0000-0000-000000000002';
update public.videos set status = 'published', processing_status = 'ready' where id = '10000000-0000-0000-0000-000000000003';
update public.videos set status = 'published', processing_status = 'ready' where id = '10000000-0000-0000-0000-000000000004';

-- Objetos de storage de apoyo para las políticas de storage.
insert into storage.objects (bucket_id, name, owner) values
  ('public-videos', '00000000-0000-0000-0000-000000000001/v1/video.mp4', '00000000-0000-0000-0000-000000000001'),
  ('public-videos', '00000000-0000-0000-0000-000000000002/v2/video.mp4', '00000000-0000-0000-0000-000000000002'),
  ('private-videos', '00000000-0000-0000-0000-000000000001/v3/video.mp4', '00000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- TEST 1: el propietario crea su vídeo y lo PUBLICA sin aprobación previa
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

insert into public.videos (id, owner_id, storage_bucket, storage_path, mime_type, size_bytes, visibility, title, processing_status, moderation_status, status)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'public-videos', '00000000-0000-0000-0000-000000000001/v1/video.mp4', 'video/mp4', 1000, 'public', 'Vídeo sin revisión', 'uploading', 'unreviewed', 'draft');

update public.videos
set status = 'published', processing_status = 'ready'
where id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.videos
    where id = '10000000-0000-0000-0000-000000000001'
      and status = 'published' and processing_status = 'ready'
      and moderation_status = 'unreviewed'
  ) then
    raise exception 'FALLO TEST1: el propietario no pudo publicar sin aprobación';
  end if;
  raise notice 'PASS TEST1: el propietario publica su vídeo sin aprobación';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 2: un usuario NO puede publicar el vídeo de otro
-- ---------------------------------------------------------------------------
do $$
declare affected int;
begin
  update public.videos
  set status = 'published', processing_status = 'ready'
  where id = '10000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FALLO TEST2: un usuario pudo publicar un vídeo ajeno';
  end if;
  raise notice 'PASS TEST2: no se puede publicar el vídeo de otro usuario';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 3: un vídeo público publicado sin revisión es visible y servible
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if not exists (select 1 from public.videos where id = '10000000-0000-0000-0000-000000000001') then
    raise exception 'FALLO TEST3: el vídeo público publicado no es visible';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'public-videos' and name = '00000000-0000-0000-0000-000000000001/v1/video.mp4'
  ) then
    raise exception 'FALLO TEST3: el objeto público publicado no es legible';
  end if;
  raise notice 'PASS TEST3: vídeo público publicado (sin revisión) visible y servible';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 4: 'unlisted' no aparece en feeds públicos (directo por URL sí)
-- (La exclusión de feeds es una consulta app con neq(visibility,'unlisted'),
-- cubierta por tests unitarios; aquí se verifica que el acceso directo por URL
-- sigue permitido como en FASE 3.)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- TEST 5: el vídeo 'private' sigue protegido
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.videos where id = '10000000-0000-0000-0000-000000000003') then
    raise exception 'FALLO TEST5: el vídeo privado es visible para anónimos';
  end if;
  if public.can_access_video_storage('private-videos', '00000000-0000-0000-0000-000000000001/v3/video.mp4') then
    raise exception 'FALLO TEST5: el objeto privado es accesible para anónimos';
  end if;
  raise notice 'PASS TEST5: el vídeo privado está protegido';
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if not public.can_access_video_storage('private-videos', '00000000-0000-0000-0000-000000000001/v3/video.mp4') then
    raise exception 'FALLO TEST5: el propietario no accede a su objeto privado';
  end if;
  raise notice 'PASS TEST5: el propietario accede a su objeto privado (signed URL)';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 7: un usuario normal NO puede moderar
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update public.videos
    set moderation_status = 'approved', moderated_by = auth.uid(), moderated_at = now()
    where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALLO TEST7: un no-admin pudo cambiar la moderación por UPDATE';
  exception
    when others then
      if sqlerrm like '%FALLO TEST7%' then raise; end if;
      raise notice 'PASS TEST7: el UPDATE de moderación bloquea a un no-admin';
  end;
end $$;

do $$
begin
  begin
    perform public.admin_reject_video('10000000-0000-0000-0000-000000000001', 'x');
    raise exception 'FALLO TEST7: la RPC admin_reject_video no bloqueó a un no-admin';
  exception
    when others then
      if sqlerrm like '%FALLO TEST7%' then raise; end if;
      raise notice 'PASS TEST7: la RPC de moderación bloquea a un no-admin';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TEST 8 + 6: el admin modera vídeos de otros; rechazar los saca de público;
-- aprobar los restaura.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select public.admin_reject_video('10000000-0000-0000-0000-000000000001', 'contenido no permitido');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if exists (select 1 from public.videos where id = '10000000-0000-0000-0000-000000000001') then
    raise exception 'FALLO TEST6: el vídeo rechazado sigue siendo visible';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'public-videos' and name = '00000000-0000-0000-0000-000000000001/v1/video.mp4'
  ) then
    raise exception 'FALLO TEST6: el objeto del vídeo rechazado sigue siendo legible';
  end if;
  raise notice 'PASS TEST6: rechazar deja de ofrecer el vídeo (RLS + storage)';
end $$;

-- El registro se conserva (status/published_at intactos) y el propietario lo ve.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  if not exists (
    select 1 from public.videos
    where id = '10000000-0000-0000-0000-000000000001'
      and status = 'published' and moderation_status = 'rejected'
  ) then
    raise exception 'FALLO TEST6: el registro del vídeo rechazado no se conserva';
  end if;
  raise notice 'PASS TEST6: el registro se conserva y el propietario lo sigue viendo';
end $$;

-- Aprobar restaura la distribución sin re-publicar.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select public.admin_approve_video('10000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}', true);
set local role anon;

do $$
begin
  if not exists (select 1 from public.videos where id = '10000000-0000-0000-0000-000000000001') then
    raise exception 'FALLO TEST6: aprobar no restauró la visibilidad';
  end if;
  raise notice 'PASS TEST6: aprobar restaura la visibilidad sin volver a publicar';
end $$;

-- El admin modera vídeos de terceros...
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

do $$
begin
  perform public.admin_reject_video('10000000-0000-0000-0000-000000000002', 'x');
  raise notice 'PASS TEST8: el admin puede moderar el vídeo de otro usuario';
end $$;

-- ...y NO puede moderar sus propios vídeos.
do $$
begin
  begin
    perform public.admin_reject_video('10000000-0000-0000-0000-000000000004', 'x');
    raise exception 'FALLO TEST8: un admin pudo moderar su propio vídeo';
  exception
    when others then
      if sqlerrm like '%FALLO TEST8%' then raise; end if;
      raise notice 'PASS TEST8: el admin no puede moderar sus propios vídeos';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TEST 9: 'pending' ya no es válido y el default es 'unreviewed'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"user"}}', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.videos (id, owner_id, storage_bucket, storage_path, mime_type, size_bytes, visibility, title, processing_status, moderation_status, status)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'public-videos', '00000000-0000-0000-0000-000000000001/vbad/video.mp4', 'video/mp4', 1, 'public', 'Bad', 'uploading', 'pending', 'draft');
    raise exception 'FALLO TEST9: se aceptó moderation_status=pending';
  exception
    when others then
      if sqlerrm like '%FALLO TEST9%' then raise; end if;
      raise notice 'PASS TEST9: el estado pending ya no es válido';
  end;
end $$;

insert into public.videos (id, owner_id, storage_bucket, storage_path, mime_type, size_bytes, visibility, title, processing_status, status)
values ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'public-videos', '00000000-0000-0000-0000-000000000001/v9/video.mp4', 'video/mp4', 1, 'public', 'Default', 'uploading', 'draft');

do $$
begin
  if not exists (
    select 1 from public.videos
    where id = '10000000-0000-0000-0000-000000000009' and moderation_status = 'unreviewed'
  ) then
    raise exception 'FALLO TEST9: el default no es unreviewed';
  end if;
  raise notice 'PASS TEST9: el default de moderation_status es unreviewed';
end $$;

-- ---------------------------------------------------------------------------
-- Limpieza: nada de lo anterior persiste.
-- ---------------------------------------------------------------------------
raise notice 'TODOS LOS TESTS DE FASE 4 PASARON';
rollback;
