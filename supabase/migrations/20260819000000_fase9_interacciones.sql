-- ============================================================================
-- FASE 9 — COMENTARIOS + FEEDBACK + REACCIONES + GUARDADOS
-- ============================================================================
--
-- Interacciones de la plataforma, construidas sobre `posts` (fase 4),
-- `projects` (fase 2) y `opportunities` (fase 6):
--
--   public.post_comments      Comentarios de posts con respuestas a 1 nivel.
--   public.project_feedback   Feedback estructurado de proyectos (1 por usuario).
--   public.post_reactions     Reacciones MVP: solo 'support' (apoyar).
--   public.saved_posts        Posts guardados (FK real, sin polimorfismo).
--   public.saved_projects     Proyectos guardados.
--   public.saved_opportunities Oportunidades guardadas.
--   public.interaction_events Bandeja de eventos (outbox) para FASE 10
--                             (notificaciones). RLS deniega TODO el acceso
--                             directo; solo triggers/service_role escriben.
--
-- Decisiones de privacidad y seguridad:
--
--   * Solo se puede interactuar con contenido PÚBLICO y distribuible:
--     - posts: publication_status='published', visibility='public' y vídeo
--       distribuible (post_is_publicly_distributable), lo que excluye draft,
--       hidden, removed y vídeos rejected/flagged.
--     - proyectos: status='published' e is_public=true (excluye draft/archived).
--     - oportunidades: opportunity_is_publicly_distributable (excluye draft,
--       closed/filled/cancelled y rejected/flagged).
--   * Bloqueos: si A bloquea a B o B bloquea a A no hay nuevas interacciones
--     entre ambos (public.profiles_can_interact). Los existentes se conservan.
--   * RLS estricta: cada rol solo escribe/modifica/borra sus propias filas;
--     anon solo LEE comentarios de contenido público y las RPC de conteo.
--   * ACL "revoke-first": se revocan los privilegios heredados de los roles
--     por defecto de Supabase antes de conceder el mínimo necesario. La
--     migración fase9_min_priv re-audita todo de forma idempotente.
--   * Conteos por agregación en RPC SECURITY DEFINER (sin contadores
--     mutables desincronizables). Las RPC filtran por contenido público, así
--     que no revelan existencia de filas sobre contenido privado.
--   * Sin capacidades admin nuevas: la moderación de comentarios/feedback no
--     está justificada todavía; admins conservan solo su acceso previo al
--     contenido base. El outbox queda reservado a service_role.
--
-- Eventos preparados para FASE 10 (no se consumen aún):
--   comment_created | reply_created | feedback_received | reaction_received
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. HELPERS DE ACCESO (SECURITY DEFINER, search_path vacío)
-- ----------------------------------------------------------------------------

-- ¿Pueden interactuar dos perfiles? False si cualquiera de los dos bloqueó al
-- otro. Auto-interacción (p_a = p_b) permitida: comentar/apoyar lo propio es
-- legítimo; profile_blocks ya impide auto-bloqueo por CHECK.
create or replace function public.profiles_can_interact(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_a is not null
    and p_b is not null
    and not exists (
      select 1
      from public.profile_blocks pb
      where (pb.profile_id = p_a and pb.blocked_id = p_b)
         or (pb.profile_id = p_b and pb.blocked_id = p_a)
    );
$$;

-- ¿El proyecto es visible públicamente? Excluye draft/archived y privados.
create or replace function public.project_is_publicly_visible(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects pr
    where pr.id = p_project_id
      and pr.status = 'published'
      and pr.is_public = true
  );
$$;

-- Helpers invocados SOLO por políticas de escritura `to authenticated` y por
-- las RPC SECURITY DEFINER (que corren como propietario y no necesitan grant).
-- anon NO obtiene EXECUTE: no debe poder sondear bloqueos/visibilidad.
revoke execute on function public.profiles_can_interact(uuid, uuid) from public;
revoke execute on function public.profiles_can_interact(uuid, uuid) from anon;
revoke execute on function public.profiles_can_interact(uuid, uuid) from authenticated;
grant execute on function public.profiles_can_interact(uuid, uuid) to authenticated;

revoke execute on function public.project_is_publicly_visible(uuid) from public;
revoke execute on function public.project_is_publicly_visible(uuid) from anon;
revoke execute on function public.project_is_publicly_visible(uuid) from authenticated;
grant execute on function public.project_is_publicly_visible(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. COMENTARIOS
-- ----------------------------------------------------------------------------

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null,
  reply_depth smallint not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_comments_body_length_check check (char_length(btrim(body)) between 1 and 2000),
  constraint post_comments_reply_depth_check check (reply_depth in (0, 1))
);

create index if not exists post_comments_post_created_idx on public.post_comments (post_id, created_at);
create index if not exists post_comments_parent_idx on public.post_comments (parent_id);
create index if not exists post_comments_author_idx on public.post_comments (author_id);

drop trigger if exists post_comments_set_updated_at on public.post_comments;
create trigger post_comments_set_updated_at
  before update on public.post_comments
  for each row execute function public.handle_updated_at();

drop trigger if exists post_comments_prevent_id_change on public.post_comments;
create trigger post_comments_prevent_id_change
  before update on public.post_comments
  for each row execute function public.prevent_id_change();

-- Profundidad máxima 1 nivel de respuestas + integridad del hilo:
-- el padre debe pertenecer al mismo post, ser raíz (depth 0) y estar visible.
create or replace function public.post_comments_validate_thread()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.post_comments;
begin
  if new.parent_id is null then
    new.reply_depth := 0;
    return new;
  end if;

  select * into v_parent from public.post_comments where id = new.parent_id;

  if v_parent.id is null
    or v_parent.post_id is distinct from new.post_id
    or v_parent.reply_depth <> 0
    or v_parent.is_hidden
  then
    raise exception 'COMMENT_PARENT_INVALID';
  end if;

  new.reply_depth := v_parent.reply_depth + 1;
  return new;
end;
$$;

drop trigger if exists post_comments_validate_thread_trigger on public.post_comments;
create trigger post_comments_validate_thread_trigger
  before insert on public.post_comments
  for each row execute function public.post_comments_validate_thread();

-- Un comentario nunca cambia de post, autor ni padre (ni de profundidad:
-- la recalcula el trigger de inserción; aquí se congela).
create or replace function public.post_comments_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.post_id is distinct from old.post_id
    or new.author_id is distinct from old.author_id
    or new.parent_id is distinct from old.parent_id
    or new.reply_depth is distinct from old.reply_depth
    or new.created_at is distinct from old.created_at
  then
    raise exception 'COMMENT_IMMUTABLE_FIELDS';
  end if;
  return new;
end;
$$;

drop trigger if exists post_comments_guard_update_trigger on public.post_comments;
create trigger post_comments_guard_update_trigger
  before update on public.post_comments
  for each row execute function public.post_comments_guard_update();

alter table public.post_comments enable row level security;

-- Lectura: comentarios visibles de posts públicos distribuibles (incluye anon);
-- cada usuario ve además los suyos aunque los haya ocultado.
drop policy if exists "post_comments_select_public" on public.post_comments;
create policy "post_comments_select_public"
  on public.post_comments for select
  using (
    is_hidden = false
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.visibility = 'public'
        and public.post_is_publicly_distributable(p.publication_status, p.visibility, p.video_id)
    )
  );

drop policy if exists "post_comments_select_own" on public.post_comments;
create policy "post_comments_select_own"
  on public.post_comments for select
  to authenticated
  using (auth.uid() = author_id);

-- Escritura: solo como auth.uid(), sobre posts públicos distribuibles y sin
-- bloqueo mutuo entre comentarista y autor del post.
drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own"
  on public.post_comments for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.visibility = 'public'
        and public.post_is_publicly_distributable(p.publication_status, p.visibility, p.video_id)
        and public.profiles_can_interact(auth.uid(), p.author_id)
    )
  );

-- Edición propia (body/is_hidden); el trigger congela el resto de columnas.
drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own"
  on public.post_comments for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own"
  on public.post_comments for delete
  to authenticated
  using (auth.uid() = author_id);

revoke all privileges on table public.post_comments from anon;
revoke all privileges on table public.post_comments from authenticated;
grant select on table public.post_comments to anon;
grant select, insert, update, delete on table public.post_comments to authenticated;

-- ----------------------------------------------------------------------------
-- 3. FEEDBACK ESTRUCTURADO DE PROYECTOS
-- ----------------------------------------------------------------------------

create table if not exists public.project_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  understanding text not null,
  problem text,
  useful text,
  unclear text,
  suggestions text,
  would_use text not null default 'maybe',
  interest_score smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_feedback_understanding_length_check
    check (char_length(btrim(understanding)) between 10 and 2000),
  constraint project_feedback_problem_length_check check (char_length(coalesce(problem, '')) <= 2000),
  constraint project_feedback_useful_length_check check (char_length(coalesce(useful, '')) <= 2000),
  constraint project_feedback_unclear_length_check check (char_length(coalesce(unclear, '')) <= 2000),
  constraint project_feedback_suggestions_length_check
    check (char_length(coalesce(suggestions, '')) <= 2000),
  constraint project_feedback_would_use_check check (would_use in ('yes', 'no', 'maybe')),
  constraint project_feedback_interest_score_check
    check (interest_score is null or interest_score between 0 and 10),
  -- Un feedback por usuario y proyecto: se actualiza, nunca se duplica.
  constraint project_feedback_project_author_unique unique (project_id, author_id)
);

create index if not exists project_feedback_author_idx on public.project_feedback (author_id);

drop trigger if exists project_feedback_set_updated_at on public.project_feedback;
create trigger project_feedback_set_updated_at
  before update on public.project_feedback
  for each row execute function public.handle_updated_at();

drop trigger if exists project_feedback_prevent_id_change on public.project_feedback;
create trigger project_feedback_prevent_id_change
  before update on public.project_feedback
  for each row execute function public.prevent_id_change();

-- El feedback nunca cambia de proyecto ni de autor.
create or replace function public.project_feedback_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'FEEDBACK_IMMUTABLE_FIELDS';
  end if;
  return new;
end;
$$;

drop trigger if exists project_feedback_guard_update_trigger on public.project_feedback;
create trigger project_feedback_guard_update_trigger
  before update on public.project_feedback
  for each row execute function public.project_feedback_guard_update();

alter table public.project_feedback enable row level security;

-- El autor ve/edita lo suyo; el propietario y miembros del proyecto leen el
-- feedback recibido; admin solo lectura justificada por auditoría futura.
drop policy if exists "project_feedback_select_own" on public.project_feedback;
create policy "project_feedback_select_own"
  on public.project_feedback for select
  to authenticated
  using (auth.uid() = author_id);

drop policy if exists "project_feedback_select_project_team" on public.project_feedback;
create policy "project_feedback_select_project_team"
  on public.project_feedback for select
  to authenticated
  using (
    exists (
      select 1 from public.projects pr
      where pr.id = project_id
        and (pr.owner_id = auth.uid() or public.is_project_member(pr.id))
    )
  );

drop policy if exists "project_feedback_select_admin" on public.project_feedback;
create policy "project_feedback_select_admin"
  on public.project_feedback for select
  to authenticated
  using (public.is_platform_admin());

-- Solo feedback sobre proyectos públicos publicados; sin self-feedback y sin
-- interacción entre perfiles bloqueados.
drop policy if exists "project_feedback_insert_own" on public.project_feedback;
create policy "project_feedback_insert_own"
  on public.project_feedback for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and public.project_is_publicly_visible(project_id)
    and exists (
      select 1 from public.projects pr
      where pr.id = project_id
        and pr.owner_id <> auth.uid()
        and public.profiles_can_interact(auth.uid(), pr.owner_id)
    )
  );

drop policy if exists "project_feedback_update_own" on public.project_feedback;
create policy "project_feedback_update_own"
  on public.project_feedback for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "project_feedback_delete_own" on public.project_feedback;
create policy "project_feedback_delete_own"
  on public.project_feedback for delete
  to authenticated
  using (auth.uid() = author_id);

revoke all privileges on table public.project_feedback from anon;
revoke all privileges on table public.project_feedback from authenticated;
grant select, insert, update, delete on table public.project_feedback to authenticated;

-- ----------------------------------------------------------------------------
-- 4. REACCIONES (MVP: solo 'support')
-- ----------------------------------------------------------------------------

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'support',
  created_at timestamptz not null default now(),
  constraint post_reactions_pk primary key (post_id, profile_id, reaction_type),
  constraint post_reactions_type_check check (reaction_type in ('support'))
);

create index if not exists post_reactions_profile_idx on public.post_reactions (profile_id);

alter table public.post_reactions enable row level security;

drop policy if exists "post_reactions_select_own" on public.post_reactions;
create policy "post_reactions_select_own"
  on public.post_reactions for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "post_reactions_insert_own" on public.post_reactions;
create policy "post_reactions_insert_own"
  on public.post_reactions for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.visibility = 'public'
        and public.post_is_publicly_distributable(p.publication_status, p.visibility, p.video_id)
        and public.profiles_can_interact(auth.uid(), p.author_id)
    )
  );

drop policy if exists "post_reactions_delete_own" on public.post_reactions;
create policy "post_reactions_delete_own"
  on public.post_reactions for delete
  to authenticated
  using (auth.uid() = profile_id);

revoke all privileges on table public.post_reactions from anon;
revoke all privileges on table public.post_reactions from authenticated;
grant select, insert, delete on table public.post_reactions to authenticated;

-- Toggle idempotente de apoyo: crea o elimina según estado actual. Devuelve
-- true si quedó apoyado tras la llamada. Falla (RLS) si el post no es público
-- distribuible o hay bloqueo mutuo.
create or replace function public.toggle_post_support(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := auth.uid();
begin
  if v_profile is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and p.visibility = 'public'
      and public.post_is_publicly_distributable(p.publication_status, p.visibility, p.video_id)
      and public.profiles_can_interact(v_profile, p.author_id)
  ) then
    raise exception 'POST_NOT_INTERACTABLE';
  end if;

  if exists (
    select 1 from public.post_reactions r
    where r.post_id = p_post_id and r.profile_id = v_profile and r.reaction_type = 'support'
  ) then
    delete from public.post_reactions r
    where r.post_id = p_post_id and r.profile_id = v_profile and r.reaction_type = 'support';
    return false;
  end if;

  insert into public.post_reactions (post_id, profile_id, reaction_type)
  values (p_post_id, v_profile, 'support')
  on conflict (post_id, profile_id, reaction_type) do nothing;

  return true;
end;
$$;

revoke execute on function public.toggle_post_support(uuid) from public;
revoke execute on function public.toggle_post_support(uuid) from anon;
revoke execute on function public.toggle_post_support(uuid) from authenticated;
grant execute on function public.toggle_post_support(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. GUARDADOS (FKs reales, sin relación polimórfica)
-- ----------------------------------------------------------------------------

create table if not exists public.saved_posts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_posts_pk primary key (profile_id, post_id)
);

create table if not exists public.saved_projects (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_projects_pk primary key (profile_id, project_id)
);

create table if not exists public.saved_opportunities (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_opportunities_pk primary key (profile_id, opportunity_id)
);

create index if not exists saved_posts_post_idx on public.saved_posts (post_id);
create index if not exists saved_projects_project_idx on public.saved_projects (project_id);
create index if not exists saved_opportunities_opportunity_idx on public.saved_opportunities (opportunity_id);

-- Guardados: privados por diseño. Cada perfil solo ve/gestiona los suyos y
-- solo puede guardar contenido públicamente visible en ese momento.
alter table public.saved_posts enable row level security;

drop policy if exists "saved_posts_select_own" on public.saved_posts;
create policy "saved_posts_select_own"
  on public.saved_posts for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "saved_posts_insert_own" on public.saved_posts;
create policy "saved_posts_insert_own"
  on public.saved_posts for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.visibility = 'public'
        and public.post_is_publicly_distributable(p.publication_status, p.visibility, p.video_id)
    )
  );

drop policy if exists "saved_posts_delete_own" on public.saved_posts;
create policy "saved_posts_delete_own"
  on public.saved_posts for delete
  to authenticated
  using (auth.uid() = profile_id);

revoke all privileges on table public.saved_posts from anon;
revoke all privileges on table public.saved_posts from authenticated;
grant select, insert, delete on table public.saved_posts to authenticated;

alter table public.saved_projects enable row level security;

drop policy if exists "saved_projects_select_own" on public.saved_projects;
create policy "saved_projects_select_own"
  on public.saved_projects for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "saved_projects_insert_own" on public.saved_projects;
create policy "saved_projects_insert_own"
  on public.saved_projects for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and public.project_is_publicly_visible(project_id)
  );

drop policy if exists "saved_projects_delete_own" on public.saved_projects;
create policy "saved_projects_delete_own"
  on public.saved_projects for delete
  to authenticated
  using (auth.uid() = profile_id);

revoke all privileges on table public.saved_projects from anon;
revoke all privileges on table public.saved_projects from authenticated;
grant select, insert, delete on table public.saved_projects to authenticated;

alter table public.saved_opportunities enable row level security;

drop policy if exists "saved_opportunities_select_own" on public.saved_opportunities;
create policy "saved_opportunities_select_own"
  on public.saved_opportunities for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "saved_opportunities_insert_own" on public.saved_opportunities;
create policy "saved_opportunities_insert_own"
  on public.saved_opportunities for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id
        and public.opportunity_is_publicly_distributable(
          o.status, o.visibility, o.moderation_status, o.opportunity_type, o.ends_at
        )
    )
  );

drop policy if exists "saved_opportunities_delete_own" on public.saved_opportunities;
create policy "saved_opportunities_delete_own"
  on public.saved_opportunities for delete
  to authenticated
  using (auth.uid() = profile_id);

revoke all privileges on table public.saved_opportunities from anon;
revoke all privileges on table public.saved_opportunities from authenticated;
grant select, insert, delete on table public.saved_opportunities to authenticated;

-- ----------------------------------------------------------------------------
-- 6. CONTEOS POR AGREGACIÓN (RPC SECURITY DEFINER)
-- ----------------------------------------------------------------------------
-- Filtran SIEMPRE por contenido público distribuible: para contenido privado
-- devuelven 0 filas (no revelan existencia). Sin columnas contador mutables.

create or replace function public.get_post_interaction_counts(p_post_ids uuid[])
returns table (post_id uuid, comment_count bigint, support_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    (select count(*) from public.post_comments c
      where c.post_id = p.id and c.is_hidden = false) as comment_count,
    (select count(*) from public.post_reactions r
      where r.post_id = p.id and r.reaction_type = 'support') as support_count
  from public.posts p
  where p.id = any (p_post_ids)
    and p.visibility = 'public'
    and public.post_is_publicly_distributable(p.publication_status, p.visibility, p.video_id);
$$;

revoke execute on function public.get_post_interaction_counts(uuid[]) from public;
revoke execute on function public.get_post_interaction_counts(uuid[]) from anon;
revoke execute on function public.get_post_interaction_counts(uuid[]) from authenticated;
grant execute on function public.get_post_interaction_counts(uuid[]) to anon, authenticated;

create or replace function public.get_project_feedback_count(p_project_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.project_is_publicly_visible(p_project_id) then (
    select count(*) from public.project_feedback f where f.project_id = p_project_id
  ) else 0 end;
$$;

revoke execute on function public.get_project_feedback_count(uuid) from public;
revoke execute on function public.get_project_feedback_count(uuid) from anon;
revoke execute on function public.get_project_feedback_count(uuid) from authenticated;
grant execute on function public.get_project_feedback_count(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. OUTBOX DE EVENTOS PARA FASE 10 (notificaciones)
-- ----------------------------------------------------------------------------
-- Tabla sin políticas RLS (denegación total para anon/authenticated): solo
-- service_role y estos triggers SECURITY DEFINER acceden. FASE 10 añadirá un
-- consumidor; hoy nadie lee esta tabla desde la app.

create table if not exists public.interaction_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint interaction_events_type_check check (
    event_type in ('comment_created', 'reply_created', 'feedback_received', 'reaction_received')
  )
);

create index if not exists interaction_events_unprocessed_idx
  on public.interaction_events (created_at)
  where processed_at is null;

alter table public.interaction_events enable row level security;
-- SIN políticas: RLS niega todo acceso directo a anon/authenticated.

revoke all privileges on table public.interaction_events from anon;
revoke all privileges on table public.interaction_events from authenticated;

create or replace function public.interaction_event_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.interaction_events (event_type, actor_id, payload)
  values (
    case when new.parent_id is null then 'comment_created' else 'reply_created' end,
    new.author_id,
    jsonb_build_object(
      'comment_id', new.id,
      'post_id', new.post_id,
      'parent_id', new.parent_id
    )
  );
  return new;
end;
$$;

create or replace function public.interaction_event_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.interaction_events (event_type, actor_id, payload)
  values (
    'feedback_received',
    new.author_id,
    jsonb_build_object('feedback_id', new.id, 'project_id', new.project_id)
  );
  return new;
end;
$$;

create or replace function public.interaction_event_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.interaction_events (event_type, actor_id, payload)
  values (
    'reaction_received',
    new.profile_id,
    jsonb_build_object('post_id', new.post_id, 'reaction_type', new.reaction_type)
  );
  return new;
end;
$$;

-- Funciones de trigger: no invocables directamente por nadie.
revoke all privileges on function public.interaction_event_comment() from public, anon, authenticated;
revoke all privileges on function public.interaction_event_feedback() from public, anon, authenticated;
revoke all privileges on function public.interaction_event_reaction() from public, anon, authenticated;

drop trigger if exists post_comments_event_trigger on public.post_comments;
create trigger post_comments_event_trigger
  after insert on public.post_comments
  for each row execute function public.interaction_event_comment();

drop trigger if exists project_feedback_event_trigger on public.project_feedback;
create trigger project_feedback_event_trigger
  after insert on public.project_feedback
  for each row execute function public.interaction_event_feedback();

drop trigger if exists post_reactions_event_trigger on public.post_reactions;
create trigger post_reactions_event_trigger
  after insert on public.post_reactions
  for each row execute function public.interaction_event_reaction();

commit;
