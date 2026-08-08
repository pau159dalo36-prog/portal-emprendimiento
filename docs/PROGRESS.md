# Estado del proyecto — FASE 3 (Vídeos)

## Estado general

- ✅ **PASOS 1–8 completados y verificados** (subida, imágenes, publicación,
  moderación). Lint, typecheck, tests y build en verde.
- ✅ **PASO 9**: panel `/panel/videos` con secciones por estado y acciones
  condicionadas (publicar sin requisito de moderación;
  retirar/archivar/desarchivar/eliminar).
- ✅ **PASO 10**: reproducción por rol respetando RLS; signed URLs en servidor;
  organización, idioma y estados en `/videos/[id]`.
- ✅ **PASO 10b**: reproductor de vídeo custom (`video-player.tsx`) con controles
  de play/pause, progreso, volumen/mute, fullscreen, captions y atajos de teclado.
- ✅ **PASO 11**: vídeos en proyecto, perfil y organización; `VIDEO_WITH_DETAILS`
  incluye `organization`; filtros explícitos `ready` + `distributable`.
- ✅ **PASO 12**: portada con vídeos reales; `ShortVideosRail` solo con vídeos
  verticales reales (`isVerticalVideo`).
- ✅ **PASO 13**: navegación con "Publicar vídeo", "Mis vídeos" y enlace admin
  condicionado al rol.
- ✅ **PASO 14**: portada automática desde frame del vídeo por instante
  (`VideoCoverGenerator` + `frame.ts`: `loadVideoElement`, `seekVideoTo`,
  `captureVideoFrame` → WebP/JPEG).
- ✅ **PASO 15**: borrado completo (vídeo + miniatura + portada + captions).
- ✅ **PASO 16**: i18n es/en con las claves nuevas (797 simétricas; namespace
  `player` y claves `cover*`, `createdOn`, `publishedAtLabel`, `noOrganization`).
- ✅ **PASO 17**: tests ampliados (109 en total, 11 archivos; incluye
  `src/videos/panel.test.ts` y `formatPlaybackTime` en `utils.test.ts`).
- 📝 **PASO 18/19**: documentación creada (este directorio).

## Verificación actual

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (109)
- `npm run build` ✅ (30 rutas)

## Pendiente / decisiones

- El propietario no puede "reenviar a moderación" (el trigger exige admin para
  cambiar `moderation_status`). Los rechazados solo se pueden editar/eliminar.
- La publicación **no** exige aprobación: el propietario publica sin revisión y
  la moderación es post-publicación. Las server actions cierran la invariante
  también fuera de la UI (`canPublishVideo` + checks de estado/objeto).
- La lógica de secciones y acciones del panel vive en `src/videos/panel.ts`
  (exportada y probada en `panel.test.ts`).
- Los captions se limpian con el bucket del vídeo (no existe `captions_bucket`).

## Remoto

- Proyecto enlazado: `efgmjuzcqolpibraymol` (no tocar `raqcchcvypeptywpjisn`).
- Sin commit/push pendiente de autorización.
