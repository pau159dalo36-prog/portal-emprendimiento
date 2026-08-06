-- FASE 3 — Storage y vídeos (migración no destructiva)
-- Añade únicamente tablas, buckets, funciones y políticas nuevas. No modifica ni
-- elimina nada existente. No contiene DROP TABLE/DELETE/TRUNCATE sobre datos.
--
-- Modelo de datos: la publicación se realiza DIRECTAMENTE sobre la tabla `videos`
-- (columnas title, caption, status, published_at). No existe `video_publications`.
--
-- Invariantes de seguridad que impone esta migración:
--  * Las lecturas públicas exigen status='published' + processing_status='ready'
--    + moderation_status='approved' (tanto en RLS como en el helper de storage).
--    Un vídeo pendiente solo lo ve su propietario; no se lista públicamente.
--  * La moderación es SOLO administrativa: `is_platform_admin()` comprueba
--    exclusivamente auth.jwt()->app_metadata->'role'='admin' y es una función
--    normal (no SECURITY DEFINER): no eleva privilegios y no hay ningún guard de
--    transacción manipulable por el cliente. Las RPCs admin_approve_video /
--    admin_reject_video / admin_flag_video (SECURITY DEFINER, search_path='')
--    verifican el rol internamente, rechazan moderar vídeos propios y registran
--    moderated_by/moderated_at/moderation_reason. El trigger de ciclo de vida
--    bloquea cualquier cambio de moderación salvo que el autor de la sentencia
--    sea un administrador distinto del propietario (auth.jwt(), no configurable).
--    El propietario no puede autoaprobarse (ni siquiera siendo admin).
--  * Clases de visibilidad con bucket obligatorio: pública (public/unlisted) →
--    public-videos; protegida (registered_users/project_members/private) →
--    private-videos. Tras completar la subida (processing_status deja de ser
--    'uploading') el bucket y la clase quedan congelados y no se puede revertir
--    processing_status a 'uploading' (evita eludir la congelación). Cambiar de
--    clase exige volver a subir o migrar explícitamente el fichero.
--  * Miniaturas/portadas con bucket explícito (thumbnail_bucket/poster_bucket):
--    la clase pública (public/unlisted) solo puede usar `video-thumbnails`; la
--    clase protegida solo puede usar `private-videos` o no tener imagen pública.
--    La lectura pública de `video-thumbnails` exige que el objeto esté
--    referenciado por un vídeo publicado, listo y aprobado (o ser del propio
--    usuario), para que un vídeo pendiente/protegido nunca filtre su portada.
--  * El propietario no puede cambiar owner_id, ni auto-aprobar la moderación, ni
--    marcar processing_status='ready' sin publicar, ni publicar un vídeo no listo.
--  * Un vídeo solo puede asociarse a un proyecto/organización del que el autor sea
--    miembro (WITH CHECK de las políticas).

-- ============================================================================
-- 1. Catálogo de idiomas de origen de vídeo (códigos ISO 639-1)
-- ============================================================================
create table public.video_languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint video_languages_code_check check (code ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

insert into public.video_languages (code, name, sort_order) values
  ('es', 'Español', 1),
  ('en', 'English', 2)
on conflict (code) do nothing;

-- ============================================================================
-- 2. Tabla `videos` — metadatos, publicación y visibilidad en un solo registro
-- ============================================================================
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text,
  mime_type text not null,
  size_bytes bigint not null,
  duration_seconds integer,
  width integer,
  height integer,
  aspect_ratio text,
  thumbnail_path text,
  poster_path text,
  thumbnail_bucket text,
  poster_bucket text,
  captions_path text,
  transcript text,
  original_language text not null default 'es',
  title text not null,
  caption text,
  processing_status text not null default 'uploading',
  moderation_status text not null default 'pending',
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  moderation_reason text,
  visibility text not null default 'private',
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  constraint videos_bucket_check check (
    storage_bucket in ('public-videos', 'private-videos')
  ),
  -- Una clase de visibilidad tiene un bucket obligatorio: público → public-videos,
  -- protegido → private-videos. No se puede mezclar.
  constraint videos_bucket_visibility_check check (
    (
      storage_bucket = 'public-videos'
      and visibility in ('public', 'unlisted')
    )
    or (
      storage_bucket = 'private-videos'
      and visibility in ('registered_users', 'project_members', 'private')
    )
  ),
  -- La miniatura/póster se asocia a un bucket explícito (solo puede vivir en el
  -- bucket de miniaturas públicas o en el bucket privado) y siempre que exista
  -- la ruta debe existir el bucket (y viceversa).
  constraint videos_thumbnail_bucket_check check (
    thumbnail_bucket in ('video-thumbnails', 'private-videos')
  ),
  constraint videos_poster_bucket_check check (
    poster_bucket in ('video-thumbnails', 'private-videos')
  ),
  constraint videos_thumbnail_bucket_presence_check check (
    (thumbnail_path is null and thumbnail_bucket is null)
    or (thumbnail_path is not null and thumbnail_bucket is not null)
  ),
  constraint videos_poster_bucket_presence_check check (
    (poster_path is null and poster_bucket is null)
    or (poster_path is not null and poster_bucket is not null)
  ),
  constraint videos_size_check check (size_bytes >= 0),
  constraint videos_duration_check check (
    duration_seconds is null or (duration_seconds >= 0 and duration_seconds <= 180)
  ),
  constraint videos_dimensions_check check (
    width is null or (width > 0 and height is not null and height > 0)
  ),
  constraint videos_aspect_ratio_check check (
    aspect_ratio is null or aspect_ratio ~ '^[0-9]{1,4}:[0-9]{1,4}$'
  ),
  constraint videos_processing_status_check check (
    processing_status in ('uploading', 'uploaded', 'validating', 'ready', 'failed', 'removed')
  ),
  constraint videos_moderation_status_check check (
    moderation_status in ('pending', 'approved', 'rejected', 'flagged')
  ),
  constraint videos_visibility_check check (
    visibility in ('public', 'registered_users', 'project_members', 'private', 'unlisted')
  ),
  constraint videos_status_check check (
    status in ('draft', 'published', 'hidden', 'removed', 'archived')
  ),
  constraint videos_published_at_check check (
    status <> 'published' or published_at is not null
  ),
  constraint videos_title_length check (
    length(btrim(title)) between 2 and 120
  ),
  constraint videos_caption_length check (
    caption is null or length(caption) <= 2000
  ),
  constraint videos_mime_check check (mime_type in ('video/mp4', 'video/webm')),
  constraint videos_language_check check (
    original_language ~ '^[a-z]{2}(-[A-Z]{2})?$'
  ),
  -- Auditoría de moderación: si se registra un moderador debe haber cuándo. El
  -- moderador puede quedar a null si su perfil se elimina después (on delete set
  -- null), conservando la marca de tiempo.
  constraint videos_moderation_audit_check check (
    moderated_by is null or moderated_at is not null
  ),
  -- Solo los vídeos en espera no tienen auditoría de moderación.
  constraint videos_moderation_state_check check (
    moderation_status = 'pending' or moderated_at is not null
  ),
  constraint videos_moderation_reason_length check (
    moderation_reason is null or length(moderation_reason) <= 500
  )
);

-- ============================================================================
-- 3. Índices
-- ============================================================================
create index if not exists video_languages_sort_order_idx on public.video_languages (sort_order);
create index if not exists videos_owner_id_idx on public.videos (owner_id);
create index if not exists videos_project_id_idx on public.videos (project_id);
create index if not exists videos_visibility_idx on public.videos (visibility);
create index if not exists videos_processing_status_idx on public.videos (processing_status);
create index if not exists videos_listing_idx on public.videos (status, visibility, processing_status, published_at desc);
create index if not exists videos_organization_id_idx on public.videos (organization_id);
create index if not exists videos_published_at_idx on public.videos (published_at);
create index if not exists videos_thumbnail_path_idx on public.videos (thumbnail_path);
create index if not exists videos_poster_path_idx on public.videos (poster_path);

-- ============================================================================
-- 4. Triggers
-- ============================================================================
drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
  before update on public.videos
  for each row execute function public.handle_updated_at();

drop trigger if exists videos_prevent_id_change on public.videos;
create trigger videos_prevent_id_change
  before update on public.videos
  for each row execute function public.prevent_id_change();

-- Mantiene `published_at` sincronizado con el estado de la publicación.
create or replace function public.videos_sync_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' then
    if new.published_at is null then
      new.published_at = now();
    end if;
  else
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists videos_sync_published_at on public.videos;
create trigger videos_sync_published_at
  before insert or update on public.videos
  for each row execute function public.videos_sync_published_at();

-- Invariantes de ciclo de vida: el propietario no puede cambiar de dueño, no puede
-- auto-aprobar la moderación, no puede marcar `ready` sin publicar y no puede publicar
-- un vídeo que no esté listo. Solo se crean vídeos como borrador en espera de moderación.
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
       or new.moderation_status is distinct from 'pending' then
      raise exception 'un vídeo solo puede crearse como borrador en espera';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists videos_validate_state_change on public.videos;
create trigger videos_validate_state_change
  before insert or update on public.videos
  for each row execute function public.videos_validate_state_change();

-- Clases de visibilidad: pública (public/unlisted) y protegida
-- (registered_users/project_members/private). Función pura usada en CHECKs y triggers.
create or replace function public.video_visibility_class(p_visibility text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_visibility in ('public', 'unlisted') then 'public'
    when p_visibility in ('registered_users', 'project_members', 'private') then 'protected'
    else null
  end;
$$;

-- Inmovilidad del archivo tras completar la subida: una vez que
-- `processing_status` deja de ser 'uploading' ya no se puede cambiar el bucket
-- de almacenamiento ni saltar de clase de visibilidad (público ↔ protegido).
-- Cambiar de clase requiere volver a subir o migrar explícitamente el fichero.
create or replace function public.videos_validate_visibility_bucket()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.processing_status <> 'uploading' then
    if new.storage_bucket is distinct from old.storage_bucket then
      raise exception 'no se puede cambiar el bucket de almacenamiento tras completar la subida';
    end if;

    if public.video_visibility_class(new.visibility)
       is distinct from public.video_visibility_class(old.visibility) then
      raise exception 'no se puede cambiar la clase de visibilidad tras completar la subida';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists videos_validate_visibility_bucket on public.videos;
create trigger videos_validate_visibility_bucket
  before update on public.videos
  for each row execute function public.videos_validate_visibility_bucket();

-- Miniaturas/portadas con bucket explícito: la clase pública (public/unlisted)
-- solo puede usar el bucket público `video-thumbnails`; la clase protegida solo
-- puede usar `private-videos` (o no tener imagen). Así un vídeo protegido nunca
-- expone su portada por URL pública.
create or replace function public.videos_validate_thumbnail_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_class text;
begin
  v_class := public.video_visibility_class(new.visibility);

  if v_class = 'protected' then
    if new.thumbnail_path is not null
       and new.thumbnail_bucket is distinct from 'private-videos' then
      raise exception 'los vídeos protegidos solo pueden tener miniaturas en private-videos';
    end if;
    if new.poster_path is not null
       and new.poster_bucket is distinct from 'private-videos' then
      raise exception 'los vídeos protegidos solo pueden tener portadas en private-videos';
    end if;
  elsif v_class = 'public' then
    if new.thumbnail_path is not null
       and new.thumbnail_bucket is distinct from 'video-thumbnails' then
      raise exception 'los vídeos públicos deben usar el bucket público de miniaturas';
    end if;
    if new.poster_path is not null
       and new.poster_bucket is distinct from 'video-thumbnails' then
      raise exception 'los vídeos públicos deben usar el bucket público de portadas';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists videos_validate_thumbnail_visibility on public.videos;
create trigger videos_validate_thumbnail_visibility
  before insert or update on public.videos
  for each row execute function public.videos_validate_thumbnail_visibility();

-- ============================================================================
-- 5. Helper SECURITY DEFINER para autorizar objetos de storage privados
-- Evita recursión de RLS: las políticas de storage no consultan `videos`
-- directamente, sino a través de esta función (el dueño postgres omite RLS).
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
          and v.moderation_status = 'approved'
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

-- ============================================================================
-- 5b. Moderación administrativa
-- Helper de rol y RPCs admin-only. El propietario (y cualquier usuario no admin)
-- no puede modificar `moderation_status` ni sus campos de auditoría: el trigger
-- `videos_validate_state_change` lo bloquea salvo que el autor de la sentencia
-- sea un administrador distinto del propietario (verificado con auth.jwt()).
-- No existe ningún guard de transacción manipulable por el cliente.
-- ============================================================================

-- Comprueba EXCLUSIVAMENTE el rol de plataforma en app_metadata del JWT.
-- No es SECURITY DEFINER (solo lee auth.jwt(), claims firmados por el servidor):
-- no necesita elevar privilegios y así se reduce la superficie de elevación.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

create or replace function public.admin_approve_video(p_video_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_video_id is null then
    raise exception 'id de vídeo no válido' using errcode = '22023';
  end if;

  if not public.is_platform_admin() then
    raise exception 'permiso denegado: se requiere rol de administrador'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.videos where id = p_video_id and owner_id = auth.uid()
  ) then
    raise exception 'un administrador no puede moderar sus propios vídeos'
      using errcode = '42501';
  end if;

  update public.videos
  set moderation_status = 'approved',
      moderation_reason = null,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_video_id;

  if not found then
    raise exception 'no se encontró el vídeo' using errcode = '22023';
  end if;

  return true;
end;
$$;

create or replace function public.admin_reject_video(p_video_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_video_id is null then
    raise exception 'id de vídeo no válido' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'el motivo de moderación no puede superar 500 caracteres'
      using errcode = '22023';
  end if;

  if not public.is_platform_admin() then
    raise exception 'permiso denegado: se requiere rol de administrador'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.videos where id = p_video_id and owner_id = auth.uid()
  ) then
    raise exception 'un administrador no puede moderar sus propios vídeos'
      using errcode = '42501';
  end if;

  update public.videos
  set moderation_status = 'rejected',
      moderation_reason = p_reason,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_video_id;

  if not found then
    raise exception 'no se encontró el vídeo' using errcode = '22023';
  end if;

  return true;
end;
$$;

create or replace function public.admin_flag_video(p_video_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_video_id is null then
    raise exception 'id de vídeo no válido' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'el motivo de moderación no puede superar 500 caracteres'
      using errcode = '22023';
  end if;

  if not public.is_platform_admin() then
    raise exception 'permiso denegado: se requiere rol de administrador'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.videos where id = p_video_id and owner_id = auth.uid()
  ) then
    raise exception 'un administrador no puede moderar sus propios vídeos'
      using errcode = '42501';
  end if;

  update public.videos
  set moderation_status = 'flagged',
      moderation_reason = p_reason,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_video_id;

  if not found then
    raise exception 'no se encontró el vídeo' using errcode = '22023';
  end if;

  return true;
end;
$$;

-- ============================================================================
-- 6. Row Level Security — `videos`
-- ============================================================================
alter table public.videos enable row level security;

-- Lectura pública: vídeo publicado, listo, aprobado y con visibilidad pública o "unlisted".
-- Mientras `moderation_status` sea 'pending'/'rejected'/'flagged' el vídeo no se lista.
drop policy if exists "videos_select_public" on public.videos;
create policy "videos_select_public"
  on public.videos for select
  using (
    status = 'published'
      and processing_status = 'ready'
      and moderation_status = 'approved'
      and visibility in ('public', 'unlisted')
  );

drop policy if exists "videos_select_own" on public.videos;
create policy "videos_select_own"
  on public.videos for select
  using (auth.uid() = owner_id);

-- Cualquier usuario autenticado ve vídeos publicados y aprobados de visibilidad `registered_users`.
drop policy if exists "videos_select_registered" on public.videos;
create policy "videos_select_registered"
  on public.videos for select
  using (
    auth.role() = 'authenticated'
      and status = 'published'
      and processing_status = 'ready'
      and moderation_status = 'approved'
      and visibility = 'registered_users'
  );

-- Miembros del proyecto asociado ven vídeos publicados y aprobados de visibilidad `project_members`.
drop policy if exists "videos_select_project_members" on public.videos;
create policy "videos_select_project_members"
  on public.videos for select
  using (
    status = 'published'
      and processing_status = 'ready'
      and moderation_status = 'approved'
      and visibility = 'project_members'
      and project_id is not null
      and public.is_project_member(project_id)
  );

drop policy if exists "videos_insert_own" on public.videos;
create policy "videos_insert_own"
  on public.videos for insert
  with check (
    auth.uid() = owner_id
      and (project_id is null or public.is_project_member(project_id))
      and (organization_id is null or public.is_organization_member(organization_id))
  );

drop policy if exists "videos_update_own" on public.videos;
create policy "videos_update_own"
  on public.videos for update
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
      and (project_id is null or public.is_project_member(project_id))
      and (organization_id is null or public.is_organization_member(organization_id))
  );

drop policy if exists "videos_delete_own" on public.videos;
create policy "videos_delete_own"
  on public.videos for delete
  using (auth.uid() = owner_id);

-- ============================================================================
-- 7. Row Level Security — `video_languages`
-- ============================================================================
alter table public.video_languages enable row level security;

drop policy if exists "video_languages_select_all" on public.video_languages;
create policy "video_languages_select_all"
  on public.video_languages for select
  using (true);

-- ============================================================================
-- 8. Permisos mínimos (auto_expose_new_tables desactivado)
-- ============================================================================
grant usage on schema public to anon, authenticated;

grant select on public.video_languages, public.videos to anon, authenticated;

grant select, insert, update, delete on public.videos to authenticated;

-- Permisos de ejecución de funciones: las funciones de trigger no deben poder
-- invocarse directamente y el helper de storage solo se expone a los roles que lo
-- usan dentro de las políticas (anon/authenticated).
revoke execute on function public.videos_sync_published_at() from public;
revoke execute on function public.videos_validate_state_change() from public;
revoke execute on function public.videos_validate_visibility_bucket() from public;
revoke execute on function public.videos_validate_thumbnail_visibility() from public;
revoke execute on function public.can_access_video_storage(text, text) from public;
grant execute on function public.can_access_video_storage(text, text) to anon, authenticated;

-- Clasificación de visibilidad (función pura usada en CHECKs y triggers).
revoke execute on function public.video_visibility_class(text) from public;
grant execute on function public.video_visibility_class(text) to anon, authenticated;

-- Moderación: el helper de rol y las RPCs admin solo son ejecutables por
-- `authenticated`; la propia función verifica internamente que el usuario sea
-- administrador. Nunca por `public` ni por `anon`.
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

revoke execute on function public.admin_approve_video(uuid) from public, anon;
grant execute on function public.admin_approve_video(uuid) to authenticated;

revoke execute on function public.admin_reject_video(uuid, text) from public, anon;
grant execute on function public.admin_reject_video(uuid, text) to authenticated;

revoke execute on function public.admin_flag_video(uuid, text) from public, anon;
grant execute on function public.admin_flag_video(uuid, text) to authenticated;

-- ============================================================================
-- 9. Storage — buckets y políticas
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('public-videos', 'public-videos', true),
  ('private-videos', 'private-videos', false),
  ('video-thumbnails', 'video-thumbnails', true)
on conflict (id) do nothing;

-- Límites conservadores (plan gratuito): vídeo hasta 100 MB, miniatura hasta 5 MB.
update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array['video/mp4', 'video/webm']
where id in ('public-videos', 'private-videos');

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'video-thumbnails';

-- Cada usuario solo opera dentro de su carpeta `<auth.uid>/...` y solo sobre sus
-- propios archivos. Ningún usuario puede sobrescribir archivos de otro.

drop policy if exists "videos_public_read" on storage.objects;
create policy "videos_public_read"
  on storage.objects for select
  using (bucket_id = 'public-videos');

drop policy if exists "videos_public_insert_own" on storage.objects;
create policy "videos_public_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'public-videos'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "videos_public_update_own" on storage.objects;
create policy "videos_public_update_own"
  on storage.objects for update
  using (
    bucket_id = 'public-videos'
      and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'public-videos'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "videos_public_delete_own" on storage.objects;
create policy "videos_public_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'public-videos'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

-- private-videos: solo lectura autorizada (signed URLs). La autorización se
-- deriva de la tabla `videos` a través del helper SECURITY DEFINER.
drop policy if exists "videos_private_select_authorized" on storage.objects;
create policy "videos_private_select_authorized"
  on storage.objects for select
  using (
    bucket_id = 'private-videos'
      and public.can_access_video_storage(bucket_id, name)
  );

drop policy if exists "videos_private_insert_own" on storage.objects;
create policy "videos_private_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'private-videos'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "videos_private_update_own" on storage.objects;
create policy "videos_private_update_own"
  on storage.objects for update
  using (
    bucket_id = 'private-videos'
      and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'private-videos'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "videos_private_delete_own" on storage.objects;
create policy "videos_private_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'private-videos'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Miniaturas/portadas: el bucket `video-thumbnails` es público SOLO para
-- objetos referenciados por un vídeo publicado, listo y aprobado de clase
-- pública (public/unlisted), o para su propio propietario (previsualización de
-- subida y panel). Así un vídeo pendiente o protegido nunca filtra su portada.
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
            and v.moderation_status = 'approved'
        )
        or exists (
          select 1 from public.videos v
          where v.poster_path = name
            and v.poster_bucket = 'video-thumbnails'
            and v.visibility in ('public', 'unlisted')
            and v.status = 'published'
            and v.processing_status = 'ready'
            and v.moderation_status = 'approved'
        )
      )
  );

drop policy if exists "video_thumbnails_insert_own" on storage.objects;
create policy "video_thumbnails_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'video-thumbnails'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "video_thumbnails_update_own" on storage.objects;
create policy "video_thumbnails_update_own"
  on storage.objects for update
  using (
    bucket_id = 'video-thumbnails'
      and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'video-thumbnails'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "video_thumbnails_delete_own" on storage.objects;
create policy "video_thumbnails_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'video-thumbnails'
      and (storage.foldername(name))[1] = auth.uid()::text
  );
