-- Correctivo aditivo (FASE 3.3, PASO 1)
-- La política "videos_public_read" anterior exponía por URL directa CUALQUIER
-- objeto de public-videos (incluidos vídeos pendientes de moderación,
-- rechazados, marcados o no publicados) porque solo comprobaba el bucket.
--
-- Solo es aditiva: no toca tablas, buckets, funciones ni otras políticas.
-- Sustituye únicamente la política de SELECT del bucket público por una que
-- exige que el registro asociado en public.videos esté publicado, listo y
-- aprobado (o que el solicitante sea el propietario del objeto).
--
-- El patrón (subconsulta a public.videos dentro de una política de
-- storage.objects) es el mismo que ya usa "video_thumbnails_public_read",
-- validado en producción con esta misma migración.

begin;

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
            and v.moderation_status = 'approved'
            and v.visibility in ('public', 'unlisted')
        )
      )
  );

commit;
