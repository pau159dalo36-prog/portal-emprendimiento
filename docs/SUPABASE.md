# Supabase

## Proyecto

- **Project ref**: `efgmjuzcqolpibraymol`
- **Región/URL**: `https://efgmjuzcqolpibraymol.supabase.co`
- **Base de datos**: PostgreSQL 17 (remoto)

El proyecto local está **enlazado** al remoto (`supabase/.temp/linked-project.json`). No se usa Docker ni `supabase start` para este flujo.

## Variables de entorno

| Variable                            | Descripción                                         | Ejemplo                                         |
| ----------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`          | URL del proyecto Supabase                           | `https://efgmjuzcqolpibraymol.supabase.co`      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase                        | `sb_publishable_...`                            |
| `NEXT_PUBLIC_SITE_URL`              | URL pública de la app para redirects de auth        | `http://localhost:3000`                         |

Plantilla en `.env.example` (versionada). `.env.local` está excluida por Git.

> La `publishable key` no se expone por CLI: se introduce manualmente en `.env.local`. Si falta, el código compila pero falla con un mensaje claro al usar Supabase en ejecución (`src/lib/env.ts`).

## Clientes

| Archivo                          | Ámbito    | Uso                                        |
| -------------------------------- | --------- | ------------------------------------------ |
| `src/lib/supabase/client.ts`     | Navegador | Componentes del lado cliente (`createBrowserClient`) |
| `src/lib/supabase/server.ts`     | Servidor  | Server Components, Server Actions, Route Handlers (`createServerClient` + `cookies()`) |
| `src/lib/supabase/proxy.ts`      | Proxy     | Renovación de sesión en `src/proxy.ts`     |

Todos usan `@supabase/ssr` y tipan con `Database` desde `src/types/database.types.ts`. Nunca se importan claves privadas en estos archivos.

## Proxy (`src/proxy.ts`)

- Convención de Next.js 16 (`proxy.ts` dentro de `src/`).
- Renueva la sesión con `@supabase/ssr` y valida la identidad con `supabase.auth.getClaims()` (no con `getSession()`).
- Copia cookies entre request y response.
- El `matcher` excluye recursos estáticos e imágenes.
- Todavía no protege rutas concretas: solo deja el mecanismo de sesión preparado.

## Flujo code-first

```
SQL en supabase/migrations/
        │
        ▼
supabase:db:push        → aplica migraciones al remoto
        │
        ▼
supabase:types          → regenera src/types/database.types.ts desde el esquema real
        │
        ▼
next build / typecheck  → el código consume tipos generados
```

## Configuración de Auth (config.toml)

Estado remoto sincronizado mediante `supabase config push`:

- `site_url = "http://localhost:3000"`
- Redirects exactos permitidos:
  - `http://localhost:3000/auth/callback` (callback de autenticación y confirmación de correo)
  - `http://localhost:3000/auth/reset-password` (recuperación de contraseña)
  - `http://localhost:3000/auth/update-password` (actualización de contraseña)
  - `http://localhost:3000/onboarding`
  - `http://localhost:3000/panel`

No se modifican proveedores OAuth ni SMTP.

## Seguridad

- Las claves de servicio (`service_role`) no se usan en el cliente ni en el proxy.
- No se registran secretos en logs ni en Git.
- Decisiones de autorización futuras se basarán en `getClaims()` verificado, nunca en la sesión almacenada en cookies.
