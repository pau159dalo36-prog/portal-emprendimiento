-- FASE 4 — Moderación post-publicación (migración de ajuste, no destructiva)
-- ============================================================================
-- Objetivo: que el propietario publique su vídeo SIN aprobación previa de
-- moderación (upload → ready → published → visible si visibility='public'),
-- manteniendo la moderación administrativa como control POST-publicación.
--
-- Qué cambia y por qué es seguro:
--  * `moderation_status` deja de bloquear la publicación: publicar solo exige
--    `status='published'` + `processing_status='ready'`. El estado inicial pasa
--    de 'pending' a 'unreviewed' (valor permitido por la constraint).
--  * Se introduce un único predicado canónico `video_is_publicly_distributable`
--    = "no está rechazado ni marcado". Un vídeo publicado se sirve al público
--    (RLS, storage, signed URLs) si es distributable. rechazado/flagged dejan de
--    estar disponibles públicamente de inmediato, pero el registro, `status` y
--    `published_at` se conservan; un 'approved' posterior lo restaura sin
--    volver a publicar. No hay cambio de estado automático ni re-publicación.
--  * La moderación sigue siendo SOLO administrativa: las RPCs
--    admin_approve_video / admin_reject_video / admin_flag_video (SECURITY
--    DEFINER, search_path='') verifican `is_platform_admin()` y rechazan moderar
--    vídeos propios; el trigger bloquea cualquier cambio de moderación por un
--    autor que no sea admin distinto del propietario. Nada de esto se toca.
--  * No se relajan permisos: las políticas de RLS y de storage dejan de exigir
--    'approved' para distribuir, pero SÍ bloquean rejected/flagged. El
--    propietario y el admin conservan exactamente las mismas lecturas que antes.
--  * Cambios de esquema: constraint CHECK del estado (se amplía con
--    'unreviewed'), constraint de auditoría (unreviewed no requiere auditoría),
--    default de columna y re-creación de políticas/funciones afectadas. Se
--    migran las filas 'pending' existentes a 'unreviewed' (desactivando el
--    trigger de ciclo de vida solo durante esa UPDATE controlada).

begin;

-- ============================================================================
-- 1. Datos y esquema de `moderation_status`
-- ============================================================================

-- Se sueltan las constraints antes de migrar los datos (el valor 'unreviewed'
-- no pasa la constraint antigua).
alter table public.videos drop constraint if exists videos_moderation_status_check;
alter table public.videos drop constraint if exists videos_moderation_state_check;

-- Migración de datos: 'pending' → 'unreviewed'. Se desactiva temporalmente el
-- trigger de ciclo de vida para que esta UPDATE administrativa no se interprete
-- como una modificación de moderación no autorizada (la realiza la migración,
-- con rol de dueño, no un cliente).
alter table public.videos disable trigger videos_validate_state_change;
update public.videos set moderation_status = 'unreviewed' where moderation_status = 'pending';
alter table public.videos enable trigger videos_validate_state_change;

alter table public.videos add constraint videos_moderation_status_check check (
  moderation_status in ('unreviewed', 'approved', 'rejected', 'flagged')
);

-- La auditoría sigue siendo obligatoria para todo estado "revisado"; solo los
-- vídeos sin revisar no tienen moderated_by/moderated_at.
alter table public.videos add constraint videos_moderation_state_check check (
  moderation_status = 'unreviewed' or moderated_at is not null
);

alter table public.videos alter column moderation_status set default 'unreviewed';

-- ============================================================================
-- 2. Predicado canónico de distribución pública
-- Devuelve true salvo rechazado/flagged. Es la ÚNICA fuente de verdad usada por
-- las políticas de RLS, las políticas de storage y `can_access_video_storage`
-- para decidir si un vídeo publicado se sirve al público. Así, "un vídeo
-- publicado sin revisión se sirve" y "rechazado/marcado queda bloqueado" no
-- pueden divergir entre capas.
-- ============================================================================
create or replace function public.video_is_publicly_distributable(p_moderation_status text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_moderation_status is null
         or not (p_moderation_status in ('rejected', 'flagged'));
$$;

revoke execute on function public.video_is_publicly_distributable(text) from public;
grant execute on function public.video_is_publicly_distributable(text) to anon, authenticated;

-- ============================================================================
-- 3. Trigger de ciclo de vida: los nuevos vídeos se crean como
-- `draft/uploading/unreviewed`. Publicar solo exige `ready` (sin moderación).
-- El bloqueo administrativo de la moderación se conserva intacto.
-- ============================================================================
create or replace function public.videos_validate_state_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'no se puede cambiar el propietario de un vídeo';
    end if;

    -- Moderación exclusivamente administrativa: cualquier cambio de
    -- `moderation_status` o de sus campos de auditoría exige un administrador de
    -- plataforma distinto del propietario. Se verifica con auth.jwt() a través de
    -- `is_platform_admin()`; NO se confía en ninguna variable de sesión que el
    -- cliente pueda fijar (no existe guard de transacción).
    if new.moderation_status is distinct from old.moderation_status
       or new.moderated_by is distinct from old.moderated_by
       or new.moderated_at is distinct from old.moderated_at
       or new.moderation_reason is distinct from old.moderation_reason then
      if not public.is_platform_admin() then
        raise exception 'la moderación solo puede gestionarla un administrador';
      end if;
      if new.owner_id = auth.uid() then
        raise exception 'un administrador no puede moderar sus propios vídeos';
      end if;
    end if;

    -- Una vez completada la subida no se puede volver a estado 'uploading':
    -- impediría eludir la congelación de bucket/clase de visibilidad.
    if new.processing_status = 'uploading'
       and old.processing_status is distinct from 'uploading' then
      raise exception 'no se puede revertir el estado de subida';
    end if;

    if new.status = 'published'
       and old.status is distinct from 'published'
       and new.processing_status is distinct from 'ready' then
      raise exception 'no se puede publicar un vídeo que no esté listo';
    end if;

    if new.processing_status = 'ready'
       and old.processing_status is distinct from 'ready'
       and new.status is distinct from 'published' then
      raise exception 'no se puede marcar un vídeo como listo sin publicarlo';
    end if;
  else
    if new.status is distinct from 'draft'
       or new.processing_status is distinct from 'uploading'
       or new.moderation_status is distinct from 'unreviewed' then
      raise exception 'un vídeo solo puede crearse como borrador sin revisar';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists videos_validate_state_change on public.videos;
create trigger videos_validate_state_change
  before insert or update on public.videos
  for each row execute function public.videos_validate_state_change();

-- ============================================================================
-- 4. RLS sobre `videos`: distribuir un vídeo publicado ya no exige 'approved',
-- solo que no esté rechazado ni marcado.
-- ============================================================================

drop policy if exists "videos_select_public" on public.videos;
create policy "videos_select_public"
  on public.videos for select
  using (
    status = 'published'
      and processing_status = 'ready'
      and public.video_is_publicly_distributable(moderation_status)
      and visibility in ('public', 'unlisted')
  );

drop policy if exists "videos_select_registered" on public.videos;
create policy "videos_select_registered"
  on public.videos for select
  using (
    auth.role() = 'authenticated'
      and status = 'published'
      and processing_status = 'ready'
      and public.video_is_publicly_distributable(moderation_status)
      and visibility = 'registered_users'
  );

drop policy if exists "videos_select_project_members" on public.videos;
create policy "videos_select_project_members"
  on public.videos for select
  using (
    status = 'published'
      and processing_status = 'ready'
      and public.video_is_publicly_distributable(moderation_status)
      and visibility = 'project_members'
      and project_id is not null
      and public.is_project_member(project_id)
  );

-- ============================================================================
-- 5. `can_access_video_storage` (SECURITY DEFINER): la autorización de objetos
-- de private-videos usa el mismo predicado de distribución.
-- ============================================================================
create or replace function public.can_access_video_storage(p_bucket text, p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.videos v
    where (
          (v.storage_bucket = p_bucket and v.storage_path = p_path)
          -- Miniaturas/portadas privadas conviven en private-videos (el bucket
          -- de la columna debe coincidir con el bucket consultado).
          or (p_bucket = 'private-videos' and v.thumbnail_path = p_path and v.thumbnail_bucket = 'private-videos')
          or (p_bucket = 'private-videos' and v.poster_path = p_path and v.poster_bucket = 'private-videos')
        )
      and (
        v.owner_id = auth.uid()
        or (
          auth.role() = 'authenticated'
          and v.status = 'published'
          and v.processing_status = 'ready'
          and public.video_is_publicly_distributable(v.moderation_status)
          and (
            v.visibility = 'registered_users'
            or (
              v.visibility = 'project_members'
              and v.project_id is not null
              and public.is_project_member(v.project_id)
            )
          )
        )
      )
  );
$$;

revoke execute on function public.can_access_video_storage(text, text) from public;
grant execute on function public.can_access_video_storage(text, text) to anon, authenticated;

-- ============================================================================
-- 6. Políticas de storage: se sirven los objetos de vídeos publicados y
-- distributables (sin exigir 'approved'); rejected/flagged quedan bloqueados.
-- ============================================================================

drop policy if exists "videos_public_read" on storage.objects;
create policy "videos_public_read"
  on storage.objects for select
  using (
    bucket_id = 'public-videos'
      and (
        -- El propietario siempre puede leer y validar sus propios objetos
        -- (necesario durante la subida y la vista previa previa a publicar).
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (
          select 1
          from public.videos v
          where v.storage_bucket = 'public-videos'
            and v.storage_path = name
            and v.status = 'published'
            and v.processing_status = 'ready'
            and public.video_is_publicly_distributable(v.moderation_status)
            and v.visibility in ('public', 'unlisted')
        )
      )
  );

drop policy if exists "video_thumbnails_public_read" on storage.objects;
create policy "video_thumbnails_public_read"
  on storage.objects for select
  using (
    bucket_id = 'video-thumbnails'
      and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (
          select 1 from public.videos v
          where v.thumbnail_path = name
            and v.thumbnail_bucket = 'video-thumbnails'
            and v.visibility in ('public', 'unlisted')
            and v.status = 'published'
            and v.processing_status = 'ready'
            and public.video_is_publicly_distributable(v.moderation_status)
        )
        or exists (
          select 1 from public.videos v
          where v.poster_path = name
            and v.poster_bucket = 'video-thumbnails'
            and v.visibility in ('public', 'unlisted')
            and v.status = 'published'
            and v.processing_status = 'ready'
            and public.video_is_publicly_distributable(v.moderation_status)
        )
      )
  );

commit;
