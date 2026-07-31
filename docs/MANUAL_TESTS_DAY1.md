# Manual de pruebas — Día 1

Pruebas manuales para validar el onboarding, la edición de perfil, el perfil público, el avatar y el panel privado. Ejecutar con el servidor local (`npm run dev`) y un proyecto Supabase enlazado.

## Preparación

1. Arrancar el servidor: `npm run dev` y abrir `http://localhost:3000`.
2. Tener a mano **dos cuentas** de correo distintas (A y B) sin registrar todavía.
3. Confirmar el correo de cada cuenta desde el correo recibido (los emails de confirmación los gestiona Supabase Auth).

## Autenticación y guardas de rutas

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|--------------------|
| 1 | Registro nuevo | Ir a `/registrarse`, crear la cuenta A y confirmar el correo | Redirige a `/onboarding` (no a `/panel`). |
| 2 | Acceso sin sesión | Cerrar sesión e ir a `/onboarding`, `/panel` y `/configuracion/perfil` | En los tres redirige a `/iniciar-sesion`. |
| 3 | Onboarding incompleto | Con la cuenta A sin terminar, ir directamente a `/panel` | Redirige a `/onboarding`. |
| 4 | Onboarding completo | Terminar los 5 pasos de la cuenta A | Redirige a `/panel` y, al volver a `/onboarding`, redirige de nuevo a `/panel`. |
| 5 | Sesión persistente | Recargar la pestaña y cerrar el navegador sin cerrar sesión | Sigue autenticado en `/panel`. |
| 6 | Cierre de sesión | Cerrar sesión desde el panel | Redirige a la portada o `/iniciar-sesion` y el acceso a `/panel` queda bloqueado. |

## Onboarding (5 pasos)

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|--------------------|
| 7 | Validación de paso 1 | Dejar vacíos los campos obligatorios del paso 1 y pulsar Continuar | Muestra errores por campo; no avanza. |
| 8 | Username en uso | En el paso 1 usar el username de la cuenta B (ya registrada) | Error: "Ese username ya está en uso." en el campo username. |
| 9 | Formato de username | Introducir mayúsculas o símbolos inválidos | Se filtran al escribir; el resto queda válido. |
| 10 | Volver sin guardar | En el paso 4 marcar habilidades, pulsar Volver y volver a Continuar | Vuelve al paso 4; los cambios no guardados del paso 4 se conservan mientras no se confirme "Continuar". |
| 11 | Guardado por pasos | Completar paso 1 y recargar la página | Los datos del paso 1 siguen precargados (se guardan en BD). |
| 12 | Nivel de habilidad | En el paso 4 marcar una habilidad y asignarle nivel 1-5 | El nivel se guarda y aparece en el perfil público con su etiqueta. |
| 13 | Intereses duplicados | Intentar añadir dos intereses idénticos | El segundo se rechaza (mensaje de duplicado). |
| 14 | Finalización | Completar los 5 pasos | Redirige a `/panel` y el "Ver cómo me ven los demás" enlaza al perfil público. |

## Perfil público y privacidad

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|--------------------|
| 15 | Perfil público anónimo | Cerrar sesión e ir a `/perfil/<username-A>` | Se ve el perfil completo (avatar, titular, bio, habilidades, intereses, disponibilidad, "Se unió en …"). |
| 16 | Perfil inexistente | Ir a `/perfil/este-usuario-no-existe` | Página 404. |
| 17 | Perfil privado | Cuenta A: poner "Perfil público" desactivado. Cerrar sesión e ir a `/perfil/<username-A>` | Página 404 (no se filtra contenido). |
| 18 | Propietario ve su privado | Con la cuenta A con perfil privado, iniciar sesión e ir a `/perfil/<username-A>` | Ve su propio perfil. |
| 19 | Intentar editar otro perfil | Con la cuenta A iniciada, manipular el formulario de `/configuracion/perfil` cambiando el `id`/username de destino (inspección de red o curl a la Server Action) | La acción no modifica el perfil de B (RLS); el perfil de B permanece intacto. |
| 20 | Links externos | En el perfil público comprobar que las URLs de Web/LinkedIn abren en pestaña nueva con `rel="noopener noreferrer"` | Abren correctamente en nueva pestaña. |

## Edición de perfil

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|--------------------|
| 21 | Guardar cambios | Cambiar titular, bio, disponibilidad y habilidades; pulsar Guardar cambios | Mensaje de éxito y el perfil público refleja los cambios. |
| 22 | Username en uso | Cambiar el username por el de la cuenta B | Error en el campo username; el resto de datos siguen precargados. |
| 23 | URL inválida | En Web escribir `javascript:alert(1)` o `ftp://...` | Error de validación: debe empezar por `http://` o `https://`. |
| 24 | Validación sin HTML5 | En un campo obligatorio pulsar Guardar con el valor vacío | La validación la hace el servidor (formularios con `noValidate`); aparece el error por campo. |
| 25 | Avatar (subir) | En `/configuracion/perfil` subir una imagen JPG/PNG | Se comprime a WebP, se guarda al instante y se muestra en el perfil público. |
| 26 | Avatar (reemplazar) | Subir una segunda imagen | Reemplaza a la anterior (sin acumular archivos en el bucket `avatars`). |
| 27 | Avatar (eliminar) | Pulsar quitar foto | Desaparece el avatar y aparece el fallback con las iniciales del nombre. |
| 28 | Avatar en onboarding | En el paso 1 del onboarding de una cuenta nueva subir una foto | Se guarda al instante y se muestra en los pasos siguientes y en el panel. |

## Recuperación de contraseña

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|--------------------|
| 29 | Solicitar reseteo | En `/recuperar-contrasena` indicar el correo de la cuenta A | Muestra confirmación y llega el correo de reseteo. |
| 30 | Nueva contraseña | Abrir el enlace del correo, poner una nueva contraseña y guardar | Mensaje de éxito, redirige a `/iniciar-sesion?contrasena=actualizada`. |
| 31 | Login con la nueva | Iniciar sesión con la nueva contraseña | Acceso correcto a `/panel`. |
| 32 | Reset sin sesión | Acceder a `/actualizar-contrasena` sin haber seguido el flujo del correo | Redirige a `/recuperar-contrasena`. |

## Accesibilidad y estados de UI

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|--------------------|
| 33 | Navegación por teclado | Tabular por el onboarding (chips, selector de habilidades, avatar) | Todos los controles reciben foco visible (anillo de foco); las chips se activan con la barra espaciadora. |
| 34 | Estados de carga | Navegar entre rutas autenticadas con red lenta | Se muestra el indicador "Cargando…" de `loading.tsx`. |
| 35 | Pantalla de error | Forzar un error de render (p. ej. detener la BD) | Aparece la pantalla de error con botón "Intentar de nuevo". |

## Verificación de datos (opcional, con acceso a la BD)

1. `profiles` contiene una fila por usuario con `onboarding_completed = true` al finalizar.
2. `profile_skills`/`profile_interests` se regeneran al guardar el paso 4 o el formulario completo (delete + insert, sin duplicados).
3. El bucket `avatars` solo contiene un `avatar.webp` por usuario en `{uid}/`.
4. Las políticas RLS impiden `INSERT`/`UPDATE`/`DELETE` sobre perfiles ajenos (probable desde la consola con un JWT de la cuenta B).
