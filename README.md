# Portal de emprendimiento

Este proyecto es una base de Next.js para un portal independiente de emprendimiento orientado a publicar ideas, recibir feedback, validar proyectos, encontrar colaboradores y acceder a oportunidades.

## Stack

- Next.js 16 con App Router
- TypeScript estricto
- Tailwind CSS 4 + shadcn/ui (Base UI)
- Zod
- Supabase (PostgreSQL + Auth) mediante `@supabase/ssr`

## Requisitos

- Node.js 24 LTS (ver `.nvmrc`)
- Una cuenta de Supabase (proyecto remoto, sin Docker)

## Configuración inicial

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear `.env.local` a partir de `.env.example` e introducir los valores:

   ```bash
   copy .env.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave pública de Supabase.
   - `NEXT_PUBLIC_SITE_URL`: en desarrollo puede quedar vacía (usa `http://localhost:3000` por defecto) o indicarla explícitamente.

3. Enlazar el proyecto Supabase (si no está enlazado):

   ```bash
   npm run supabase:link
   ```

## Comandos

```bash
npm run dev               # servidor de desarrollo
npm run lint              # ESLint
npm run typecheck         # tsc --noEmit
npm run build             # build de producción
npm run check             # lint + typecheck + build

npm run supabase:link            # enlaza el proyecto remoto
npm run supabase:config:push     # empuja config.toml (auth) al remoto
npm run supabase:db:push         # aplica migraciones SQL al remoto
npm run supabase:types           # regenera src/types/database.types.ts
```

## Flujo de base de datos (code-first)

```
SQL en supabase/migrations/ → supabase:db:push → supabase:types → aplicación
```

Detalles en [docs/SUPABASE.md](./docs/SUPABASE.md) y [docs/DATABASE.md](./docs/DATABASE.md).

## Despliegue en Netlify

Netlify detecta Next.js automáticamente y aplica su adaptador OpenNext (SSR, Server Actions, Route Handlers, proxy e imágenes) sin plugins manuales.

- `netlify.toml`: solo define el comando de build (`npm run build`).
- Versión de Node: `24` LTS vía `.nvmrc` y `engines.node`.
- Variables requeridas en Netlify: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SITE_URL` (URL pública del sitio).
- Endpoint de salud: `GET /api/health`.

Guía completa en [docs/NETLIFY.md](./docs/NETLIFY.md).

## Arquitectura

- Los componentes de servidor son la opción por defecto.
- La sesión se renueva en `src/proxy.ts` con `@supabase/ssr` y `getClaims()`.
- Los clientes de Supabase viven en `src/lib/supabase/` y tipan contra `src/types/database.types.ts`.
- La estructura está preparada para incorporar ideas y comunidades en fases posteriores, sin depender de Nexora.

## Funcionalidades actuales

- Autenticación completa (registro, inicio de sesión, recuperación y cambio de contraseña).
- **Onboarding en 5 pasos** en `/onboarding` con guardado incremental de cada paso.
- **Panel privado** en `/panel` con % de perfil completado (12 secciones) y módulos "Próximamente".
- **Edición de perfil** en `/configuracion/perfil` (habilidades con nivel 1-5, intereses, enlaces, privacidad).
- **Perfil público** en `/perfil/[username]` accesible sin sesión si el perfil es público (RLS).
- **Avatar** con validación de formato/tamaño en cliente y servidor y compresión automática (bucket `avatars`).

## Estructura principal

- src/app: páginas y layout principal
- src/components/profile: formularios de onboarding y edición de perfil
- src/profiles: lógica de perfiles (constantes, datos, completitud, avatar, map)
- src/lib: utilidades compartidas (incluye clientes Supabase)
- src/proxy.ts: proxy de Next.js 16 para renovar sesión
