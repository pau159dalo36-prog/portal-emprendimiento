# Políticas de Storage

Buckets creados en la migración FASE 3 (`20260805000000_fase3_storage_videos.sql`).

## Buckets

| Bucket             | Público | Límite | MIME permitidos                     |
| ------------------ | ------- | ------ | ----------------------------------- |
| `public-videos`    | Sí      | 100 MB | `video/mp4`, `video/webm`           |
| `private-videos`   | No      | 100 MB | `video/mp4`, `video/webm`           |
| `video-thumbnails` | Sí      | 5 MB   | `image/png`, `image/jpeg`, `image/webp` |

> `video-thumbnails` es público pero **solo** para objetos referenciados por un
> vídeo publicado, listo y aprobado de clase pública (o del propio usuario):
> nunca debe contener contenido sensible de vídeos pendientes/protegidos.
> `private-videos` **nunca** es público. Los vídeos de clase protegida **no
> pueden** referenciar miniaturas públicas: el trigger
> `videos_validate_thumbnail_visibility` exige que su `thumbnail_bucket`/
> `poster_bucket` sea `private-videos` (o nulo).

## Estructura de objetos

Toda ruta comienza por `auth.uid()` del propietario:

```
<user_id>/<video_id>/<archivo-video>
<user_id>/<video_id>/thumbnail/<imagen>
<user_id>/<video_id>/poster/<imagen>
```

El primer segmento es el mecanismo de aislamiento: las políticas de escritura lo
exigen, por lo que ningún usuario puede leer/sobrescribir los archivos de otro.

## Políticas en `storage.objects`

### `public-videos`

| Política                    | Operación | Condición                                        |
| --------------------------- | --------- | ------------------------------------------------ |
| `videos_public_read`        | SELECT    | `bucket_id = 'public-videos'` y (carpeta propia **o** objeto referenciado por un vídeo público publicado/listo/aprobado) |
| `videos_public_insert_own`  | INSERT    | `bucket_id` y `foldername(name)[1] = auth.uid()` |
| `videos_public_update_own`  | UPDATE    | Ídem con USING + WITH CHECK                       |
| `videos_public_delete_own`  | DELETE    | Ídem                                             |

### `private-videos`

| Política                          | Operación | Condición                                                            |
| --------------------------------- | --------- | -------------------------------------------------------------------- |
| `videos_private_select_authorized`| SELECT    | `bucket_id` y `public.can_access_video_storage(bucket_id, name)`     |
| `videos_private_insert_own`       | INSERT    | `foldername(name)[1] = auth.uid()`                                   |
| `videos_private_update_own`       | UPDATE    | Ídem con USING + WITH CHECK                                          |
| `videos_private_delete_own`       | DELETE    | Ídem                                                                 |

La política de SELECT usa un helper `SECURITY DEFINER`
(`public.can_access_video_storage`) para evitar recursión de RLS: consulta
`public.videos` con privilegios del dueño de la migración (postgres) y comprueba

- `owner_id = auth.uid()`, **o**
- vídeo `published` + `ready` + `approved` y `visibility = 'registered_users'`, **o**
- vídeo `published` + `ready` + `approved`, `visibility = 'project_members'` y
  `public.is_project_member(project_id)`.

También autoriza `thumbnail_path`/`poster_path` de la clase protegida que
conviven en `private-videos` (verificando `thumbnail_bucket`/`poster_bucket`).
Esto permite generar signed URLs solo a quien tiene derecho de visión.

### `video-thumbnails`

| Política                       | Operación | Condición                                        |
| ------------------------------ | --------- | ------------------------------------------------ |
| `video_thumbnails_public_read` | SELECT    | `bucket_id = 'video-thumbnails'` y (carpeta propia **o** objeto referenciado por un vídeo público publicado/listo/aprobado) |
| `video_thumbnails_insert_own`  | INSERT    | `foldername(name)[1] = auth.uid()`               |
| `video_thumbnails_update_own`  | UPDATE    | Ídem con USING + WITH CHECK                      |
| `video_thumbnails_delete_own`  | DELETE    | Ídem                                             |

La condición de SELECT impide que una miniatura/póster de un vídeo pendiente,
rechazado, marcado o protegido sea legible por URL pública: el objeto solo se
sirve si lo referencia un vídeo `published` + `ready` + `approved` de clase
`public`/`unlisted`, o si el propio usuario lo solicita (previsualización de
subida y panel).

### `public-videos` — SELECT corregido (`20260806000000_fix_videos_public_read.sql`)

La versión original de `videos_public_read` solo comprobaba el bucket y servía
**cualquier** objeto de `public-videos` por URL directa (vídeos `pending`,
`rejected`, `flagged` o no publicados incluidos). La migración correctiva
`20260806000000_fix_videos_public_read.sql` (aditiva, solo `drop policy if
exists` + `create policy` de esa política) exige ahora:

- que el solicitante sea el propietario (`foldername(name)[1] = auth.uid()`),
  **o**
- que exista un registro en `public.videos` con `storage_bucket =
  'public-videos'`, `storage_path = name`, `status = 'published'`,
  `processing_status = 'ready'`, `moderation_status = 'approved'` y
  `visibility in ('public', 'unlisted')`.

Usa la misma subconsulta a `public.videos` que `video_thumbnails_public_read`
(sin recursión: las políticas de `videos` no consultan `storage.objects`), así
que la lectura pública cae de forma inmediata al retirar/archivar/rechazar un
vídeo.

## Notas de seguridad

- Los buckets se crean con `on conflict (id) do nothing` y los límites se fijan
  con `update`, de modo que la migración es idempotente y no destructiva.
- `public-videos` expone contenido por URL directa **solo** cuando el registro
  asociado está `published` + `ready` + `approved` de clase `public`/`unlisted`
  (política corregida en `20260806000000`); el control de visibilidad
  `unlisted` se implementa a nivel de aplicación (no se lista en feeds, pero la
  URL es accesible).
- **Clases de visibilidad con bucket obligatorio**: la clase pública
  (`public`/`unlisted`) solo vive en `public-videos` y la clase protegida
  (`registered_users`/`project_members`/`private`) solo en `private-videos`. Lo
  impone el CHECK `videos_bucket_visibility_check` y el trigger
  `videos_validate_visibility_bucket` (que además congela bucket y clase tras
  completar la subida; revertir `processing_status` a `uploading` está
  bloqueado, por lo que la congelación no se puede eludir). Cambiar de clase
  exige volver a subir o migrar el fichero.
- Nunca se usa la clave de servicio para firmar URLs en producción: las signed
  URLs se generan con el cliente autenticado del usuario (sujeto a RLS).
