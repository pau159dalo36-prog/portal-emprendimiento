# Manual de pruebas — Vídeos (FASE 3)

Prerequisitos: tres migraciones aplicadas en local y remoto
(`20260805000000_fase3_storage_videos.sql`, `20260806000000_fix_videos_public_read.sql`,
`20260806010000_admin_videos_select.sql`). No ejecutar migraciones nuevas sin autorización.

## 1. Subida

- [ ] Subir MP4 < 100 MB → progreso real, redirige a edición.
- [ ] Subir WebM ok.
- [ ] MP4 > 100 MB → error de validación.
- [ ] MP4 > 180 s → error de duración.
- [ ] Formato no permitido (p. ej. .avi) → error.
- [ ] Cancelar subida → borrador y objeto eliminados.
- [ ] Reintentar tras error funciona.

## 2. Portada automática

- [ ] Tras la subida se genera una portada automática desde el frame.
- [ ] La portada aparece en el reproductor de `/videos/[id]`.
- [ ] En edición, `VideoCoverGenerator` carga el vídeo y muestra el slider con la
      duración real.
- [ ] Mover el slider y "Generar portada" produce una preview del instante elegido.
- [ ] "Usar como portada" la guarda y el poster se actualiza (upsert, misma ruta).
- [ ] Con un vídeo sin signed URL (no disponible) muestra aviso sin romper la página.

## 2b. Reproductor

- [ ] Play/pause con botón y con Espacio / k.
- [ ] Barra de progreso: clic y arrastre buscan; tiempo actual/duración tabular.
- [ ] ←/→ buscan ±5 s; ↑/↓ volumen; m mute; f fullscreen; al pulsar sobre un
      input/botón no se dispara el atajo.
- [ ] El botón CC solo aparece si hay captions y alterna subtítulos.
- [ ] Cambiar de vídeo (nueva `src`) resetea el estado (loading) sin duplicar efectos.
- [ ] Sin autoplay y con `playsInline`.

## 3. Edición e imágenes

- [ ] Cambiar título/descripción/idioma se guarda.
- [ ] Cambiar visibilidad dentro de la clase congelada se permite.
- [ ] Cambiar de clase pública ↔ protegida tras la subida se bloquea.
- [ ] Subir miniatura y portada (PNG/JPEG/WebP ≤ 5 MB) se guarda.
- [ ] Reemplazar/quitar miniatura o portada funciona.
- [ ] La preview usa signed URL (no URL pública de pendientes).

## 4. Publicación y estados

- [ ] Un vídeo `uploaded` (sin revisar) se puede publicar (publicado + ready).
- [ ] Publicar un vídeo `uploading` o `failed` se bloquea.
- [ ] Publicar un vídeo `rejected`/`flagged` se bloquea (solo editar/eliminar).
- [ ] Retirar (published → hidden) lo quita de listados públicos.
- [ ] Archivar (draft/hidden → archived) y desarchivar funcionan.

## 5. Panel de vídeos (`/panel/videos`)

- [ ] Secciones: subiendo, en revisión, marcado, listo para publicar, rechazado,
      publicados, ocultos, archivados, errores.
- [ ] Cada tarjeta muestra proyecto, organización (si existe), fecha de creación y
      de publicación (si publicada) y el motivo de rechazo cuando aplica.
- [ ] Solo aparecen acciones posibles en cada estado.
- [ ] Publicar solo aparece si el vídeo está listo y no está rechazado/marcado.
- [ ] El botón eliminar pide confirmación (3 s) y borra fila + storage.

## 6. Moderación (`/admin/videos`)

- [ ] Un admin ve todos los vídeos.
- [ ] Aprobar/rechazar/marcar actualiza el estado y el motivo.
- [ ] Un admin no puede moderar sus propios vídeos.
- [ ] Un usuario no admin recibe 404 en `/admin/videos`.

## 7. Reproducción por rol

- [ ] Visitante: solo vídeos publicados+ready+distributivos y públicos/unlisted.
- [ ] Registrado: además `registered_users`.
- [ ] Miembro del proyecto: además `project_members` de sus proyectos.
- [ ] Propietario: ve sus borradores/rechazados y badges de estado, botón editar.
- [ ] Admin: ve todos los vídeos, incluidos los sin revisar.
- [ ] Vídeos protegidos reproducen vía signed URL.

## 8. Listados

- [ ] `/videos` y portada solo muestran publicados+ready+distributivos (no unlisted).
- [ ] Portada: `ShortVideosRail` solo si hay vídeos verticales reales.
- [ ] Proyecto/perfil/organización muestran sus vídeos publicados.
- [ ] Miniaturas de vídeos protegidos se cargan (signed URL), sin romper visibilidad.

## 9. Navegación

- [ ] Header: "Publicar vídeo", "Mis vídeos", y "Moderación de vídeos" solo para admin.
- [ ] Sidebar: "Mis vídeos" y enlace admin condicionado al rol.

## 10. Borrado completo

- [ ] Eliminar borra vídeo + miniatura + portada (+ captions si existen) del storage
      y la fila de la tabla.
