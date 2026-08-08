-- FASE 4.1 — Entidad genérica `posts` (migración NO destructiva)
-- ============================================================================
-- Objetivo: capa base distribuible sobre la que se construirán el feed, los
-- vídeos, los proyectos, los perfiles, las organizaciones, los comentarios, las
-- reacciones, los guardados, el empleo y las comunidades.
--
-- Principios de diseño:
--  * `videos` sigue siendo la fuente de verdad del contenido audiovisual y de su
--    visibilidad/estados. `posts` es un sobre (envelope) genérico de
--    distribución que apunta a un vídeo como mucho (UNIQUE video_id) y que el
--    feed futuro leerá como unidad.
--  * Un vídeo en `status='published'` tiene EXACTAMENTE un post asociado: lo
--    garantiza un trigger AFTER en `videos` con INSERT ... ON CONFLICT
--    (video_id) DO UPDATE (idempotente: repetir publicaciones no duplica).
--  * No se duplica la máquina de estados de `videos`: la distributividad de un
--    post de vídeo se DERIVA del vídeo mediante el predicado canónico
--    `post_is_publicly_distributable` (status published + processing ready +
--    `video_is_publicly_distributable(moderation_status)` + coherencia de
--    visibilidad). rejected/flagged/retirado/archivado dejan de distribuirse
--    de inmediato y un approve posterior lo restaura sin re-publicar.
--  * `publication_status`/`visibility` del post son proyecciones sincronizadas
--    por el trigger para los posts de vídeo y serán la fuente de verdad para
--    los tipos futuros (text, article, ...).
--  * RLS obligatoria: el usuario solo crea/edita posts propios y solo puede
--    enlazar vídeos que son suyos; el público lee únicamente posts distribuibles
--    con visibilidad estrictamente 'public' (unlisted NO es enumerable por un
--    SELECT público genérico: se reserva el acceso por enlace/ID para el futuro);
--    registered_users/project_members/private quedan protegidos; el contenido
--    moderado (rejected/flagged) nunca vuelve a ser visible a través de un post;
--    admins conservan lectura total.
--  * No hay política DELETE ni GRANT delete: los posts se gestionan por el ciclo
--    de vida de su contenido (cascade al borrar vídeo/perfil). Esto preserva la
--    invariante "un vídeo publicado ⇒ exactamente un post".
--  * Backfill idempotente de los vídeos ya publicados (no se borra ni recrea
--    ningún vídeo).
--  * No se introduce ningún SECURITY DEFINER nuevo: los triggers son invoker y
--    el predicado es una función normal STABLE (mismo patrón que
--    `video_is_publicly_distributable`).

begin;

-- ============================================================================
-- 1. Tabla `posts`
-- ============================================================================
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  post_type text not null default 'video',
  body text,
  video_id uuid unique references public.videos (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  visibility text not null default 'public',
  publication_status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Tipos preparados para fases futuras; de momento solo se crean posts de vídeo.
  constraint posts_post_type_check check (
    post_type in ('video', 'text', 'project_update', 'opportunity', 'article')
  ),
  -- Un post de tipo 'video' SIEMPRE apunta a un vídeo; el resto de tipos NO
  -- referencian vídeos (la unicidad de `video_id` garantiza un único post por
  -- vídeo y permite muchos posts sin vídeo).
  constraint posts_video_type_check check (
    (post_type = 'video' and video_id is not null)
    or (post_type <> 'video' and video_id is null)
  ),
  constraint posts_visibility_check check (
    visibility in ('public', 'registered_users', 'project_members', 'private', 'unlisted')
  ),
  constraint posts_publication_status_check check (
    publication_status in ('draft', 'published', 'hidden', 'removed')
  ),
  constraint posts_published_at_check check (
    publication_status <> 'published' or published_at is not null
  ),
  -- Para posts de vídeo el contenido vive en `videos` (caption); `body` queda
  -- reservado a los tipos futuros evitando duplicar contenido (fuente de verdad única).
  constraint posts_body_video_check check (
    post_type <> 'video' or body is null
  ),
  constraint posts_body_length check (
    body is null or length(btrim(body)) between 1 and 5000
  )
);

-- ============================================================================
-- 2. Índices (orientados al feed futuro: published_at DESC + filtros)
-- ============================================================================
create index if not exists posts_published_at_idx on public.posts (published_at desc);
create index if not exists posts_author_id_idx on public.posts (author_id);
create index if not exists posts_project_id_idx on public.posts (project_id);
create index if not exists posts_organization_id_idx on public.posts (organization_id);
create index if not exists posts_visibility_idx on public.posts (visibility);
create index if not exists posts_publication_status_idx on public.posts (publication_status);
create index if not exists posts_post_type_idx on public.posts (post_type);
create index if not exists posts_listing_idx on public.posts (publication_status, visibility, published_at desc);

-- ============================================================================
-- 3. Funciones
-- ============================================================================

-- Predicado canónico de distributividad de un post. Para posts de vídeo se
-- DERIVA por completo del vídeo (fuente de verdad única); para los tipos
-- futuros sin vídeo, del propio publication_status. Exige coherencia de
-- visibilidad entre post y vídeo (fail-closed ante divergencias).
-- NO valora el nivel de visibilidad (public/unlisted/registered_users/...):
-- ese tier lo gobierna cada política de RLS (un anónimo solo lee
-- visibility='public'). Un post sin vídeo publicado devuelve true con cualquier
-- visibilidad; la exposición la decide la política, no la capa de aplicación.
create or replace function public.post_is_publicly_distributable(
  p_publication_status text,
  p_visibility text,
  p_video_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_publication_status = 'published'
    and (
      p_video_id is null
      or exists (
        select 1
        from public.videos v
        where v.id = p_video_id
          and v.status = 'published'
          and v.processing_status = 'ready'
          and v.visibility = p_visibility
          and public.video_is_publicly_distributable(v.moderation_status)
      )
    );
$$;

-- Integridad: el autor de un post debe ser el propietario del vídeo enlazado
-- (un usuario no puede publicar vídeos de terceros a través de posts) y el
-- proyecto/organización del post de vídeo deben ser EXACTAMENTE los del vídeo:
-- el post es un sobre (envelope) de distribución que no puede desincronizarse
-- de su contenido enlazando referencias que no son las del vídeo.
create or replace function public.posts_validate_video_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_project_id uuid;
  v_organization_id uuid;
begin
  if new.video_id is not null then
    select owner_id, project_id, organization_id
    into v_owner_id, v_project_id, v_organization_id
    from public.videos
    where id = new.video_id;

    if v_owner_id is null then
      raise exception 'el vídeo asociado al post no existe';
    end if;
    if v_owner_id <> new.author_id then
      raise exception 'el autor del post debe ser el propietario del vídeo';
    end if;
    if v_project_id is distinct from new.project_id then
      raise exception 'el proyecto del post debe coincidir con el del vídeo';
    end if;
    if v_organization_id is distinct from new.organization_id then
      raise exception 'la organización del post debe coincidir con la del vídeo';
    end if;
  end if;

  return new;
end;
$$;

-- El enlace post ↔ vídeo y el autor son inmutables: el ciclo de vida se gestiona
-- a través del vídeo, no re-apuntando el post.
create or replace function public.posts_prevent_video_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.video_id is distinct from old.video_id then
    raise exception 'no se puede cambiar el vídeo asociado a un post';
  end if;
  if new.author_id is distinct from old.author_id then
    raise exception 'no se puede cambiar el autor de un post';
  end if;
  return new;
end;
$$;

-- Sincroniza el post de un vídeo con su ciclo de vida. Idempotente:
-- INSERT ... ON CONFLICT (video_id) DO UPDATE garantiza un único post por vídeo
-- aunque la acción de publicación se repita. Cuando el vídeo deja de estar
-- publicado (hidden/archived/removed/otro), el post deja de distribuirse.
create or replace function public.posts_sync_from_video()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- El post asociado se elimina en cascada por la FK; nada que hacer.
    return old;
  end if;

  if new.status = 'published' then
    insert into public.posts (
      author_id, post_type, video_id, project_id, organization_id,
      visibility, publication_status, published_at
    )
    values (
      new.owner_id, 'video', new.id, new.project_id, new.organization_id,
      new.visibility, 'published', coalesce(new.published_at, now())
    )
    on conflict (video_id) do update set
      author_id = excluded.author_id,
      project_id = excluded.project_id,
      organization_id = excluded.organization_id,
      visibility = excluded.visibility,
      publication_status = 'published',
      published_at = coalesce(excluded.published_at, now());
  else
    update public.posts
    set publication_status = case
          when new.status in ('hidden', 'archived') then 'hidden'
          when new.status = 'removed' then 'removed'
          else 'draft'
        end,
        published_at = null
    where video_id = new.id;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 4. Triggers
-- ============================================================================
drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.handle_updated_at();

drop trigger if exists posts_prevent_id_change on public.posts;
create trigger posts_prevent_id_change
  before update on public.posts
  for each row execute function public.prevent_id_change();

drop trigger if exists posts_validate_video_ownership on public.posts;
create trigger posts_validate_video_ownership
  before insert or update on public.posts
  for each row execute function public.posts_validate_video_ownership();

drop trigger if exists posts_prevent_video_change on public.posts;
create trigger posts_prevent_video_change
  before update on public.posts
  for each row execute function public.posts_prevent_video_change();

-- Al publicar/retirar/archivar un vídeo, se mantiene su post coherente.
drop trigger if exists posts_sync_from_video on public.videos;
create trigger posts_sync_from_video
  after insert or update or delete on public.videos
  for each row execute function public.posts_sync_from_video();

-- ============================================================================
-- 5. Backfill de los vídeos ya publicados (idempotente)
-- ============================================================================
insert into public.posts (
  author_id, post_type, video_id, project_id, organization_id,
  visibility, publication_status, published_at
)
select
  v.owner_id, 'video', v.id, v.project_id, v.organization_id,
  v.visibility, 'published', coalesce(v.published_at, now())
from public.videos v
where v.status = 'published'
on conflict (video_id) do update set
  author_id = excluded.author_id,
  project_id = excluded.project_id,
  organization_id = excluded.organization_id,
  visibility = excluded.visibility,
  publication_status = 'published',
  published_at = coalesce(excluded.published_at, now());

-- ============================================================================
-- 6. Row Level Security — `posts`
-- ============================================================================
alter table public.posts enable row level security;

-- Lectura pública: SOLO posts distribuibles con visibilidad estrictamente
-- 'public'. Unlisted NO es enumerable mediante un SELECT público genérico de
-- `posts` (lo garantiza la RLS, no la capa de aplicación): quedará accesible
-- por enlace/ID en el futuro mediante un mecanismo específico si hace falta.
-- No se introduce ningún SECURITY DEFINER nuevo para esto: la política basta.
drop policy if exists "posts_select_public" on public.posts;
create policy "posts_select_public"
  on public.posts for select
  using (
    public.post_is_publicly_distributable(publication_status, visibility, video_id)
      and visibility = 'public'
  );

-- El autor siempre ve sus propios posts (borradores, retirados, rechazados, ...).
drop policy if exists "posts_select_own" on public.posts;
create policy "posts_select_own"
  on public.posts for select
  using (auth.uid() = author_id);

-- Cualquier usuario autenticado lee posts distribuibles de visibilidad registered_users.
drop policy if exists "posts_select_registered" on public.posts;
create policy "posts_select_registered"
  on public.posts for select
  to authenticated
  using (
    public.post_is_publicly_distributable(publication_status, visibility, video_id)
      and visibility = 'registered_users'
  );

-- Solo miembros del proyecto asociado leen posts project_members.
drop policy if exists "posts_select_project_members" on public.posts;
create policy "posts_select_project_members"
  on public.posts for select
  to authenticated
  using (
    public.post_is_publicly_distributable(publication_status, visibility, video_id)
      and visibility = 'project_members'
      and project_id is not null
      and public.is_project_member(project_id)
  );

-- Administradores leen todo (moderación futura de posts).
drop policy if exists "posts_select_admin" on public.posts;
create policy "posts_select_admin"
  on public.posts for select
  to authenticated
  using (public.is_platform_admin());

-- El usuario solo crea posts como sí mismo y solo puede enlazar vídeos de los
-- que es propietario (o ningún vídeo). Proyecto/organización de los que es miembro.
drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  with check (
    auth.uid() = author_id
      and (
        video_id is null
        or exists (
          select 1 from public.videos v
          where v.id = video_id and v.owner_id = auth.uid()
        )
      )
      and (project_id is null or public.is_project_member(project_id))
      and (organization_id is null or public.is_organization_member(organization_id))
  );

-- El autor puede editar sus posts (body/visibility futuros); la coherencia con
-- el vídeo y la distributividad la garantizan los triggers y el predicado.
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
      and (project_id is null or public.is_project_member(project_id))
      and (organization_id is null or public.is_organization_member(organization_id))
  );

-- Sin política DELETE ni GRANT delete: los posts se retiran por el ciclo de
-- vida del contenido asociado y se eliminan en cascada.

-- ============================================================================
-- 7. Permisos mínimos (auto_expose_new_tables desactivado)
-- ============================================================================
grant usage on schema public to anon, authenticated;

grant select on public.posts to anon, authenticated;
grant select, insert, update on public.posts to authenticated;

-- Funciones de trigger: no invocables directamente.
revoke execute on function public.posts_sync_from_video() from public;
revoke execute on function public.posts_validate_video_ownership() from public;
revoke execute on function public.posts_prevent_video_change() from public;

-- Predicado usado en RLS: ejecutable por anon/authenticated.
revoke execute on function public.post_is_publicly_distributable(text, text, uuid) from public;
grant execute on function public.post_is_publicly_distributable(text, text, uuid) to anon, authenticated;

commit;
