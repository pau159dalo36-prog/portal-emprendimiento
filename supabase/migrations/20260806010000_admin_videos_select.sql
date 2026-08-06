-- ============================================================================
-- Aditiva: lectura administrativa de `videos` para la moderación.
-- El panel /admin/videos necesita leer TODOS los vídeos (incluidos los que aún
-- no están publicados/aprobados), algo que ninguna política de lectura actual
-- permite para vídeos de terceros. Solo se abre para administradores de
-- plataforma (app_metadata.role = 'admin'), verificado vía is_platform_admin(),
-- que solo lee el JWT firmado y no eleva privilegios.
-- ============================================================================

drop policy if exists "videos_select_admin" on public.videos;
create policy "videos_select_admin"
  on public.videos for select
  using (public.is_platform_admin());
