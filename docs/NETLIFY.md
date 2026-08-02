# Despliegue en Netlify (plan Free)

Este portal es una app Next.js 16 (App Router) con Supabase Auth, Server Actions,
Route Handlers y un proxy de sesión. Netlify lo detecta automáticamente y aplica
su **adaptador OpenNext** en cada build: no se instala ni configura ningún plugin
manual y no se fija ninguna versión del adaptador.

---

## 1. Arquitectura del despliegue

- **Build**: `npm run build` (Next.js 16 + Turbopack) ejecutado por Netlify.
- **Adaptador**: OpenNext de Netlify. Genera:
  - una función serverless para SSR, ISR, Server Actions, Route Handlers y `api/health`;
  - una Edge Function para el proxy de sesión (`src/proxy.ts`);
  - imagen optimizada mediante el Image CDN de Netlify (`next/image`).
- **Base de datos y auth**: Supabase remoto (proyecto `efgmjuzcqolpibraymol`). Netlify solo sirve la app; los datos no se copian al build.
- **Cookies de sesión**: seguras (`Secure`) en producción, gestionadas por `@supabase/ssr` desde `src/proxy.ts`.
- **Node**: 24 LTS (ver `.nvmrc`), la versión por defecto de Netlify.

## 2. Cómo crear el sitio con plan Free

1. Crea una cuenta en <https://app.netlify.com/> (gratuita, sin tarjeta).
2. En el dashboard, botón **Add new site → Import an existing project**.
3. El plan Free es suficiente: no se necesita ningún addon para Next.js.

## 3. Cómo conectarlo a GitHub

1. El repositorio debe estar en GitHub (sube este proyecto, conservando `package.json` en la raíz).
2. En Netlify: **Add new site → Import an existing project → GitHub**.
3. Autoriza a Netlify y elige el repositorio `portal-emprendimiento`.
4. Rama de producción: `main`. Netlify detectará automáticamente Next.js.
5. Pulsa **Deploy**. La primera build tardará unos minutos.

## 4. Comando de build

Netlify lo detecta solo. Si quieres forzarlo, déjalo en:

```toml
# netlify.toml (ya incluido)
[build]
  command = "npm run build"
```

No configures directorio `publish` manual: el adaptador OpenNext gestiona la salida
de `next build`. No uses `@netlify/plugin-nextjs` (legacy y obsoleto para esta versión).

## 5. Variables de entorno necesarias

En **Site configuration → Environment variables** (o *Site settings → Environment variables*) crea:

| Variable                            | Valor |
| ----------------------------------- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL`          | URL del proyecto, p. ej. `https://efgmjuzcqolpibraymol.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (`sb_publishable_…`) de Supabase Auth |
| `NEXT_PUBLIC_SITE_URL`              | La URL pública del sitio, p. ej. `https://NOMBRE-DEL-SITIO.netlify.app` |

Marca `NEXT_PUBLIC_SITE_URL` para producción. Como las variables `NEXT_PUBLIC_*`
se inyectan en el build, añádelas **antes** del primer deploy y vuelve a desplegar
si las cambias después.

## 6. Cómo obtener la URL pública

1. Tras el primer deploy, Netlify muestra una URL del tipo `https://NOMBRE-DEL-SITIO.netlify.app`.
2. Si quieres renombrarla: **Site configuration → Site details → Site information → Change site name**.

## 7. Cómo actualizar `NEXT_PUBLIC_SITE_URL`

1. Edita la variable en **Site configuration → Environment variables**.
2. Activa un nuevo deploy (botón **Deploy site** o un push a `main`).
3. Verifica que `getSiteUrl()` sigue usándola: en producción es obligatoria y, si
   falta, la app lanza un error claro (consulta `src/lib/env.ts`).

> No se usa ninguna URL inventada en el código: la base se lee de la variable.

## 8. Redirecciones permitidas de Supabase

En el Dashboard de Supabase: **Authentication → URL Configuration**:

1. **Site URL**: pon la URL pública, p. ej. `https://NOMBRE-DEL-SITIO.netlify.app`.
2. **Redirect URLs**: añade al menos:
   - `https://NOMBRE-DEL-SITIO.netlify.app/auth/callback`
   - `https://NOMBRE-DEL-SITIO.netlify.app/auth/reset-password`
   - `https://NOMBRE-DEL-SITIO.netlify.app/auth/confirm`
   - `https://NOMBRE-DEL-SITIO.netlify.app/onboarding`
   - `https://NOMBRE-DEL-SITIO.netlify.app/panel`
   - Mantén también los de desarrollo local (`http://localhost:3000/…`) para no romper `npm run dev`.

Alternativa code-first: actualizar `site_url` y `additional_redirect_urls` en
`supabase/config.toml` y ejecutar `npm run supabase:config:push`. Hazlo tú mismo
cuando conozcas el nombre definitivo del sitio.

## 9. Cómo probar el flujo completo en producción

1. Abre `https://NOMBRE-DEL-SITIO.netlify.app` → la portada debe cargar.
2. **Registro**: `/registrarse` → crea una cuenta. Recibirás un correo de confirmación de Supabase; ábrelo y te llevará a `/auth/callback` (o `/auth/confirm`).
3. **Login**: `/iniciar-sesion` con la cuenta confirmada.
4. **Onboarding**: si no está completo, redirige a `/onboarding`; termina los 5 pasos y llegará a `/panel`.
5. **Perfil**: en el panel, "Ver cómo me ven los demás" enlaza a `/perfil/[username]`.
6. **Recuperación**: `/recuperar-contrasena` envía un correo; el enlace va a `/auth/reset-password` → `/actualizar-contrasena`.

## 10. Cómo desplegar cambios mediante Git

1. Haz commit y push a `main`.
2. Netlify detecta el push y lanza un nuevo build automáticamente.
3. Si el build es correcto, el sitio queda actualizado en la misma URL.

## 11. Cómo detener o eliminar el sitio

- **Detener builds automáticos**: **Site configuration → Build & deploy → Continuous deployment** → desactiva *Builds* (o quita la conexión con GitHub).
- **Eliminar el sitio**: **Site configuration → Danger zone → Delete site**.

## 12. Archivos que nunca deben subirse al repositorio

- `.env`, `.env.local`, `.env.*.local` (ignorados por `.gitignore`).
- `.netlify/`, `.next/`, `node_modules/`.
- `supabase/.temp/` (ignorado por `supabase/.gitignore`).
- Claves de `service_role`, secret keys, tokens o contraseñas (nunca deben existir en el repo).

## 13. Qué hacer si falla el build

1. Abre el **Deploy log** en Netlify y busca el error.
2. Verifica que las tres variables de entorno están configuradas (builds nuevos sin variables fallan al no existir la URL del proyecto).
3. Confirma que `package-lock.json` está versionado y que instalas con `npm install` (Netlify lo hace solo).
4. Comprueba localmente el mismo comando: `npm run build` y `npm run check`.
5. Si el error menciona Node, revisa `.nvmrc` (Netlify usa `24`).

## 14. Cómo comprobar `/api/health`

- Endpoint: `https://NOMBRE-DEL-SITIO.netlify.app/api/health`.
- Respuesta esperada (no consulta BD ni expone variables):

```json
{ "status": "ok" }
```

- Pruébalo en el navegador o con `curl https://NOMBRE-DEL-SITIO.netlify.app/api/health`.
