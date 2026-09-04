// Tests de requestPasswordResetAction: el mensaje genérico se mantiene tanto
// en éxito como cuando Supabase devuelve error (no se revela si la cuenta
// existe), el error sí se registra server-side (solo code/status/message) y
// nunca se filtran datos sensibles (correo, tokens, claves, secretos).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthApiError } from "@supabase/supabase-js";
import {
  requestPasswordResetAction,
  signInAction,
  signOutAction,
  signUpAction,
  updatePasswordAction,
} from "@/actions/auth";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

vi.mock("next-intl/server", () => ({
  getLocale: () => "es",
  getTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  getPathname: (args: { href: { pathname: string; query?: Record<string, string> }; locale: string }) => {
    const path = typeof args.href === "string" ? args.href : args.href.pathname;
    const query =
      typeof args.href === "string"
        ? ""
        : args.href.query
          ? `?${new URLSearchParams(args.href.query as Record<string, string>).toString()}`
          : "";
    return `/${args.locale}${path}${query}`;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getSiteUrl: vi.fn(() => "http://localhost:3000"),
}));

vi.mock("@/lib/rate-limit", () => ({
  // El rate-limit por IP no aplica en tests unitarios: siempre dentro del límite.
  consumeRateLimit: vi.fn(async () => true),
  getAnonymousRateLimitKey: vi.fn(async () => "test-ip"),
}));

vi.mock("@/profiles/destination", () => ({
  getPostLoginDestination: vi.fn(async () => "/onboarding"),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetSiteUrl = vi.mocked(getSiteUrl);
const revalidatePath = vi.mocked((await import("next/cache")).revalidatePath);

const GENERIC_MESSAGE = "actions.auth.resetSent";

let resetPasswordForEmail: ReturnType<typeof vi.fn>;
let signUp: ReturnType<typeof vi.fn>;
let updateUser: ReturnType<typeof vi.fn>;
let signOut: ReturnType<typeof vi.fn>;
let getOwnProfile: ReturnType<typeof vi.fn>;
let getUser: ReturnType<typeof vi.fn>;
let signInWithPassword: ReturnType<typeof vi.fn>;

function setupSupabase(error?: unknown) {
  resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: error ?? null });
  signUp = vi.fn().mockResolvedValue({ data: {}, error: null });
  updateUser = vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  signOut = vi.fn().mockResolvedValue({ error: null });
  getUser = vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  signInWithPassword = vi.fn().mockResolvedValue({
    data: { session: { access_token: "tok" } },
    error: null,
  });
  getOwnProfile = vi.fn().mockResolvedValue({ data: { onboarding_completed: false }, error: null });
  mockedCreateClient.mockReturnValue({
    auth: {
      resetPasswordForEmail,
      signUp,
      updateUser,
      signOut,
      getUser,
      signInWithPassword,
    },
    rpc: getOwnProfile,
  } as never);
}

function formWithEmail(email: string): FormData {
  const form = new FormData();
  form.set("correo", email);
  return form;
}

function formWithPassword(pass: string, confirm: string): FormData {
  const form = new FormData();
  form.set("contrasena", pass);
  form.set("confirmar-contrasena", confirm);
  return form;
}

describe("requestPasswordResetAction", () => {
  beforeEach(() => {
    setupSupabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reset exitoso mantiene el mensaje genérico y no loguea errores", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await requestPasswordResetAction({ status: "idle" }, formWithEmail("USUARIO@Example.com"));

    expect(result).toEqual({ status: "success", message: GENERIC_MESSAGE });
    expect(mockedGetSiteUrl).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("envía el correo normalizado y el redirectTo al servicio de Supabase", async () => {
    await requestPasswordResetAction({ status: "idle" }, formWithEmail("Usuario@Test.COM"));

    expect(resetPasswordForEmail).toHaveBeenCalledWith("usuario@test.com", {
      redirectTo: "http://localhost:3000/auth/reset-password",
    });
  });

  it("error de Supabase mantiene el mensaje genérico para el usuario", async () => {
    setupSupabase(
      new AuthApiError("Error sending recovery email", 400, "email_provider_disabled"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await requestPasswordResetAction(
      { status: "idle" },
      formWithEmail("usuario@example.com"),
    );

    expect(result).toEqual({ status: "success", message: GENERIC_MESSAGE });
    expect(result.message).toBe(GENERIC_MESSAGE);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("el error sí se registra server-side con code, status y message", async () => {
    setupSupabase(
      new AuthApiError("Rate limit reached for email", 429, "over_email_send_rate_limit"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await requestPasswordResetAction({ status: "idle" }, formWithEmail("usuario@example.com"));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [tag, payload] = errorSpy.mock.calls[0] as [string, string];
    expect(tag).toBe("[auth:error]");
    expect(JSON.parse(payload)).toEqual({
      action: "requestPasswordReset",
      name: "AuthApiError",
      code: "over_email_send_rate_limit",
      status: 429,
      message: "Rate limit reached for email",
    });
  });

  it("nunca se filtran datos sensibles en el log", async () => {
    setupSupabase(
      new AuthApiError("Service temporarily unavailable", 503, "over_request_rate_limit"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await requestPasswordResetAction(
      { status: "idle" },
      formWithEmail("Usuario.Sensible@Example.com"),
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, payload] = errorSpy.mock.calls[0] as [string, string];
    const parsed = JSON.parse(payload) as Record<string, unknown>;

    expect(Object.keys(parsed).sort()).toEqual(["action", "code", "message", "name", "status"]);
    const lower = payload.toLowerCase();
    expect(lower).not.toContain("usuario.sensible@example.com");
    expect(lower).not.toContain("usuario.sensible");
    expect(lower).not.toContain("secret");
    expect(lower).not.toContain("api_key");
    expect(lower).not.toContain("service_role");
  });

  it("EN PRODUCCIÓN el redirectTo NO genera localhost y usa la URL del sitio", async () => {
    mockedGetSiteUrl.mockReturnValue("https://sensational-squirrel-26a2f8.netlify.app");
    await requestPasswordResetAction({ status: "idle" }, formWithEmail("usuario@example.com"));

    expect(resetPasswordForEmail).toHaveBeenCalledWith("usuario@example.com", {
      redirectTo: "https://sensational-squirrel-26a2f8.netlify.app/auth/reset-password",
    });
    const arg = resetPasswordForEmail.mock.calls[0][1] as { redirectTo: string };
    expect(arg.redirectTo).not.toContain("localhost");
  });

  it("en desarrollo usa localhost:3000", async () => {
    mockedGetSiteUrl.mockReturnValue("http://localhost:3000");
    await requestPasswordResetAction({ status: "idle" }, formWithEmail("usuario@example.com"));
    const arg = resetPasswordForEmail.mock.calls[0][1] as { redirectTo: string };
    expect(arg.redirectTo).toBe("http://localhost:3000/auth/reset-password");
  });
});

describe("signUpAction", () => {
  beforeEach(() => {
    setupSupabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockedGetSiteUrl.mockReturnValue("http://localhost:3000");
  });

  function formWithSignup(email: string, pass = "Abcdef123", confirm = pass): FormData {
    const form = new FormData();
    form.set("nombre", "Ana");
    form.set("correo", email);
    form.set("contrasena", pass);
    form.set("confirmar-contrasena", confirm);
    form.set("terminos", "on");
    return form;
  }

  it("cuando hay confirmación de email devuelve user + session null y redirige a verificar-correo", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    const redirectMock = vi.mocked((await import("next/navigation")).redirect);
    redirectMock.mockClear();

    await signUpAction({ status: "idle" }, formWithSignup("nuevo@example.com"));

    expect(redirectMock).toHaveBeenCalledWith("/es/verificar-correo");
    expect(redirectMock).not.toHaveBeenCalledWith("/es/onboarding");
  });

  it("signup con auto-login (confirmación desactivada) invalida la UI de auth y redirige al destino", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "tok" } },
      error: null,
    });
    const redirectMock = vi.mocked((await import("next/navigation")).redirect);
    redirectMock.mockClear();
    revalidatePath.mockClear();

    // La sesión real se crea: la action devuelve success + redirectTo y el
    // cliente (SignUpForm) hace una navegación completa para descartar el
    // Router Cache anónimo. No se lanza redirect server-side.
    const result = await signUpAction({ status: "idle" }, formWithSignup("auto@example.com"));

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result.status).toBe("success");
    expect(result.redirectTo).toBe("/es/onboarding");
    expect(redirectMock).not.toHaveBeenCalledWith("/es/onboarding");
  });

  it("usa emailRedirectTo con la URL del sitio + /auth/callback", async () => {
    await signUpAction({ status: "idle" }, formWithSignup("nuevo@example.com"));

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "nuevo@example.com",
        options: expect.objectContaining({
          emailRedirectTo: "http://localhost:3000/auth/callback",
        }),
      }),
    );
  });

  it("EN PRODUCCIÓN emailRedirectTo NO contiene localhost", async () => {
    mockedGetSiteUrl.mockReturnValue("https://sensational-squirrel-26a2f8.netlify.app");
    await signUpAction({ status: "idle" }, formWithSignup("nuevo@example.com"));

    const arg = signUp.mock.calls[0][0] as { options: { emailRedirectTo: string } };
    expect(arg.options.emailRedirectTo).toBe(
      "https://sensational-squirrel-26a2f8.netlify.app/auth/callback",
    );
    expect(arg.options.emailRedirectTo).not.toContain("localhost");
  });

  it("error de signUp devuelve estado error y NO muestra el mensaje de éxito falso", async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("Signup error", 500, "signup_error"),
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirectMock = vi.mocked((await import("next/navigation")).redirect);
    redirectMock.mockClear();

    const result = await signUpAction({ status: "idle" }, formWithSignup("nuevo@example.com"));

    expect(result.status).toBe("error");
    expect(result.message).toBe("actions.auth.signUpFailed");
    expect(redirectMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("usuario ya existente mantiene anti-enumeración: no muestra éxito falso, no revela", async () => {
    // Supabase puede devolver user con identities vacías o null session para un
    // email ya registrado sin revelar que existe. La UI debe seguir neutra.
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    const redirectMock = vi.mocked((await import("next/navigation")).redirect);
    redirectMock.mockClear();

    await signUpAction({ status: "idle" }, formWithSignup("existente@example.com"));

    // No redirigir al panel/onboarding (no hay sesión) — con data.user null va a
    // verificar-correo para no revelar que el email ya existe.
    expect(redirectMock).toHaveBeenCalledWith("/es/verificar-correo");
  });

  it("signup con datos inválidos devuelve error de validación sin llamar a Supabase", async () => {
    const result = await signUpAction(
      { status: "idle" },
      formWithSignup("correo-invalido", "A1", "A2"),
    );

    expect(result.status).toBe("error");
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("updatePasswordAction", () => {
  beforeEach(() => {
    setupSupabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("llama a updateUser con la nueva contraseña y devuelve redirectTo a iniciar-sesion", async () => {
    revalidatePath.mockClear();

    const result = await updatePasswordAction(
      { status: "idle" },
      formWithPassword("NuevaPass123", "NuevaPass123"),
    );

    expect(updateUser).toHaveBeenCalledWith({ password: "NuevaPass123" });
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result.status).toBe("success");
    expect(result.redirectTo).toBe("/es/iniciar-sesion?contrasena=actualizada");
  });

  it("password mismatch devuelve error de validación sin llamar a updateUser", async () => {
    const result = await updatePasswordAction(
      { status: "idle" },
      formWithPassword("NuevaPass123", "Diferente123"),
    );

    expect(result.status).toBe("error");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("password inválida (demasiado corta) devuelve error de validación", async () => {
    const result = await updatePasswordAction(
      { status: "idle" },
      formWithPassword("P1", "P1"),
    );

    expect(result.status).toBe("error");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("error de updateUser devuelve error y NO redirige", async () => {
    updateUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("update failed", 400, "weak_password"),
    });
    const redirectMock = vi.mocked((await import("next/navigation")).redirect);
    redirectMock.mockClear();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await updatePasswordAction(
      { status: "idle" },
      formWithPassword("NuevaPass123", "NuevaPass123"),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe("actions.auth.updateFailed");
    expect(redirectMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("no hay bucle hacia solicitud de email: tras éxito va a iniciar-sesion, nunca a recuperar-contrasena", async () => {
    const result = await updatePasswordAction(
      { status: "idle" },
      formWithPassword("NuevaPass123", "NuevaPass123"),
    );

    expect(result.status).toBe("success");
    expect(result.redirectTo).toContain("/es/iniciar-sesion?contrasena=actualizada");
    expect(result.redirectTo).not.toContain("recuperar-contrasena");
  });

  it("sin sesión de recuperación válida: NO llama a updateUser y va a iniciar-sesion (bloquea cambio no autorizado)", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const redirectMock = vi.mocked((await import("next/navigation")).redirect);
    // En Next.js `redirect` lanza y corta la ejecución; lo simulamos igualmente
    // para verificar que no se llega a updateUser.
    redirectMock.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT" });
    });

    await expect(
      updatePasswordAction(
        { status: "idle" },
        formWithPassword("NuevaPass123", "NuevaPass123"),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(getUser).toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/es/iniciar-sesion");
  });
});

describe("signInAction", () => {
  beforeEach(() => {
    setupSupabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function formWithLogin(email = "usuario@example.com", pass = "Abcdef123"): FormData {
    const form = new FormData();
    form.set("correo", email);
    form.set("contrasena", pass);
    return form;
  }

  it("login exitoso: invalida la UI dependiente de auth y devuelve redirectTo", async () => {
    const redirectMock = vi.mocked((await import("next/navigation")).redirect);
    redirectMock.mockClear();
    revalidatePath.mockClear();

    const result = await signInAction({ status: "idle" }, formWithLogin());

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "usuario@example.com",
      password: "Abcdef123",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    // El cliente (SignInForm) navega de forma completa (window.location.assign)
    // al destino para descartar el Router Cache anónimo.
    expect(result.status).toBe("success");
    expect(result.redirectTo).toBe("/es/onboarding");
    expect(redirectMock).not.toHaveBeenCalledWith("/es/onboarding");
  });

  it("login exitoso con onboarding completado redirige a /panel", async () => {
    // `@/profiles/destination` está mockeado a nivel de módulo; se ajusta aquí
    // para cubrir el destino /panel cuando el onboarding ya está completado.
    const destMock = vi.mocked((await import("@/profiles/destination")).getPostLoginDestination);
    destMock.mockResolvedValueOnce("/panel");

    const result = await signInAction({ status: "idle" }, formWithLogin());

    expect(result.status).toBe("success");
    expect(result.redirectTo).toBe("/es/panel");
  });

  it("login fallido NO invalida ni redirige y devuelve error genérico", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError("Invalid login", 400, "invalid_credentials"),
    });
    const redirectMock = vi.mocked((await import("next/navigation")).redirect);
    redirectMock.mockClear();
    revalidatePath.mockClear();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await signInAction({ status: "idle" }, formWithLogin());

    expect(result.status).toBe("error");
    expect(result.message).toBe("actions.auth.signInFailed");
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("email no confirmado devuelve un mensaje claro específico (no el genérico)", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError("Email not confirmed", 400, "email_not_confirmed"),
    });
    revalidatePath.mockClear();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await signInAction({ status: "idle" }, formWithLogin());

    expect(result.status).toBe("error");
    expect(result.message).toBe("actions.auth.emailNotConfirmed");
    expect(result.redirectTo).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("signIn devuelve error si no hay session y este error se distingue de credenciales inválidas", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await signInAction({ status: "idle" }, formWithLogin());

    expect(result.status).toBe("error");
    expect(result.message).toBe("actions.auth.signInFailed");
    errorSpy.mockRestore();
  });

  it("datos inválidos devuelven error de validación sin llamar a Supabase", async () => {
    const result = await signInAction({ status: "idle" }, formWithLogin("correo-invalido"));

    expect(result.status).toBe("error");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("signOutAction", () => {
  beforeEach(() => {
    setupSupabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cierra sesión, invalida la UI de auth y devuelve redirectTo a la home", async () => {
    revalidatePath.mockClear();

    const result = await signOutAction({ status: "idle" }, new FormData());

    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    // SignOutButton navega de forma completa a la home para descartar el Router
    // Cache autenticado y volver a la navegación de visitante.
    expect(result.status).toBe("success");
    expect(result.redirectTo).toBe("/es/");
  });
});
