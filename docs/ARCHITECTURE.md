# Arquitectura del Portal

## Stack tecnológico

| Capa           | Tecnología                        |
| -------------- | --------------------------------- |
| Framework      | Next.js 16 (App Router)           |
| Lenguaje       | TypeScript 5                      |
| Estilos        | Tailwind CSS 4 + shadcn/ui        |
| Base de datos  | Supabase (PostgreSQL)             |
| Autenticación  | Supabase Auth                      |
| Despliegue     | Por definir                       |

## Estructura de carpetas

```
src/
├── actions/        # Server Actions (auth, profile, avatar, videos, follows, form-state)
├── analytics/      # Telemetría de vídeo (data, config, schemas, tracker, reporter, hook)
├── app/            # Páginas y layouts (Next.js App Router)
├── auth/           # Lógica de autenticación (session, getClaims)
├── components/
│   ├── feed/       # FeedTabs, FeedPostCard, ProjectGrid, ProjectVideoCard
│   ├── explore/    # ExploreApp (hub /explorar), tarjetas de resultados
│   ├── follows/    # FollowButton
│   ├── video/      # VideoPlayer, VideoCard, upload/preview/delete/empty-state
│   ├── portal/     # Componentes específicos del portal
│   ├── profile/    # Onboarding, edición de perfil y avatar (client)
│   ├── shared/     # Componentes compartidos entre módulos
│   └── ui/         # Componentes base (shadcn/ui)
├── config/         # Constantes de dominio (posts, videos, uploads)
├── feed/           # Feed "Para ti"/"Siguiendo" (config, ranking, diversity, schemas, data, home, types)
├── follows/        # Seguimiento social (data, types, tests)
├── lib/
│   ├── env.ts      # Acceso seguro a variables de entorno
│   ├── supabase/   # Clientes Supabase (client, server, proxy)
│   └── video/      # Utilidades de vídeo (utils, preview, file-names, validation)
├── posts/          # Entidad genérica distribuible (data, types, schemas, constants)
├── profiles/       # Lógica de perfiles (constantes, datos, completitud, avatar, map)
├── proxy.ts        # Proxy de Next.js 16 (renovación de sesión)
├── search/         # Búsqueda/exploración (config, ranking, schemas, data, home, types, tests)
├── supabase/       # Cliente y configuración de Supabase
├── types/          # Tipos TypeScript compartidos
│   └── database.types.ts  # Tipos generados desde Supabase
├── validations/    # Schemas de validación (Zod)
└── videos/         # Lógica de vídeos (data, panel, types)
```

## Rutas principales

| Ruta                          | Acceso           | Descripción                                            |
| ----------------------------- | ---------------- | ------------------------------------------------------ |
| `/`                           | Público          | Homepage = feed (pestañas Para ti / Siguiendo)          |
| `/registrarse`, `/iniciar-sesion` | Público      | Autenticación (grupo `(auth)`)                         |
| `/onboarding`                 | Autenticado      | Onboarding por 5 pasos (redirige a `/panel` si acabado) |
| `/panel`                      | Autenticado      | Panel privado (redirige a `/onboarding` si incompleto) |
| `/panel/videos`               | Autenticado      | Panel del propietario (métricas de vídeo, publicar/editar/archivar) |
| `/configuracion/perfil`       | Autenticado      | Edición completa del perfil + avatar                   |
| `/perfil/[username]`          | Público          | Perfil público con layout propio (respeta RLS)         |
| `/perfil`                     | Autenticado      | Redirige al perfil público del propio usuario          |
| `/videos`                     | Público          | Exploración de vídeos (grid de `VideoCard`)            |
| `/videos/[id]`                | Público          | Página pública del vídeo (player + contador público)   |
| `/explorar`                   | Público          | Hub de búsqueda/exploración (pestañas Todo/Vídeos/Proyectos/Organizaciones/Perfiles, filtros, cursor) |
| `/publicar/video`             | Autenticado      | Subida y publicación de vídeo                          |
| `/proyectos`, `/organizaciones` | Público       | Directorios de proyectos/organizaciones                |
| `/proyectos/[slug]`, `/organizaciones/[slug]` | Público | Detalle con vídeos y FollowButton |

## Principios arquitectónicos

1. **Independencia total de Nexora**: No hay código, secrets, ni BD compartidos.
2. **API-first mindset**: Los módulos internos se diseñan pensando en una futura exposición mediante API REST.
3. **Server Components por defecto**: Se maximiza el uso de Server Components de React; solo se usa el cliente cuando es necesario.
4. **Validación en servidor y cliente**: Schemas Zod reutilizados entre Server Actions y formularios del cliente.
5. **Separación clara de capas**: UI, lógica de negocio, acceso a datos y validaciones están separadas por carpeta.
6. **Tipos generados desde la base de datos**: `Database` procede de `src/types/database.types.ts`, regenerado con `supabase gen types`.

## Flujo de datos

```
Cliente (Browser)
    ↕ NextResponse (cookies)
src/proxy.ts → renueva la sesión con @supabase/ssr + getClaims()
    ↕ Server Actions / RSC
Next.js Server
    ↕ @supabase/ssr
Supabase (PostgreSQL + Auth)
    ↕ (futuro) API REST
Nexora (sistema externo)
```

## Infraestructura Supabase

- Proyecto remoto `efgmjuzcqolpibraymol`, enlazado con Supabase CLI (sin Docker).
- Clientes: `src/lib/supabase/client.ts`, `server.ts` y `proxy.ts` basados en `@supabase/ssr`.
- Configuración de Auth como código en `supabase/config.toml` (site_url y redirects) y sincronizada con `supabase config push`.
- Detalles en [docs/SUPABASE.md](./SUPABASE.md).
