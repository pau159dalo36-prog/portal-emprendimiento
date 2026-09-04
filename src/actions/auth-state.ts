export type AuthFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /**
   * Destino tras una mutación de autenticación exitosa. Cuando está presente,
   * el cliente realiza una navegación completa (window.location.assign) para
   * descartar el Router Cache del navegador y forzar un render fresco del
   * servidor basado en la sesión real. Una navegación SPA soft (redirect de
   * Server Action) conserva el RSC anónimo cacheado y no refresca la UI.
   */
  redirectTo?: string;
}

export type AuthFormAction = (
  prevState: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export const initialAuthFormState: AuthFormState = { status: "idle" };
