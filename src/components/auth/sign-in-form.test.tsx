// Test del formulario de login REAL (SignInForm), el mismo componente montado en
// /es/iniciar-sesion.
//
// El componente usa useAuthForm, que llama directamente a la Server Action desde
// el handler de submit (await) y, al recibir status:success + redirectTo, hace la
// navegación completa (window.location.assign) de forma inmediata para descartar
// el Router Cache anónimo. En caso de error, pending se restablece SIEMPRE
// (try/finally) y el botón vuelve a su estado normal: nunca "loading" infinito.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, className, children }: { href: unknown; className?: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"} className={className}>
      {children}
    </a>
  ),
}));

// Componentes UI sustituidos por versiones planas (Base UI no se renderiza
// fiablemente en jsdom). El mock de SubmitButton reproduce el estado `isPending`
// del botón real (aria-busy + pendingText) para poder verificar que el loading
// termina.
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: (props: Record<string, unknown>) => <input type="checkbox" {...props} />,
}));
vi.mock("@/components/ui/form-message", () => ({
  FormMessage: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));
vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <label {...props}>{children}</label>
  ),
}));
vi.mock("@/components/ui/submit-button", () => ({
  SubmitButton: ({
    children,
    pendingText,
    isPending,
    ...props
  }: {
    children?: React.ReactNode;
    pendingText?: string;
    isPending?: boolean;
  } & Record<string, unknown>) => (
    <button {...props} aria-busy={isPending}>
      {isPending ? (pendingText ?? children) : children}
    </button>
  ),
}));

const { signInAction } = vi.hoisted(() => ({ signInAction: vi.fn() }));
vi.mock("@/actions/auth", () => ({ signInAction }));

import { SignInForm } from "@/components/auth/sign-in-form";

let assignMock: ReturnType<typeof vi.fn>;
const realLocation = window.location;

beforeEach(() => {
  assignMock = vi.fn();
  Object.defineProperty(window, "location", {
    value: { assign: assignMock },
    writable: true,
    configurable: true,
  });
  signInAction.mockReset();
  signInAction.mockResolvedValue({ status: "success", redirectTo: "/es/onboarding" });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "location", { value: realLocation, writable: true, configurable: true });
});

describe("SignInForm (componente de login real)", () => {
  it("con credenciales válidas navega de forma completa hacia el redirectTo", async () => {
    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("/es/onboarding"));
    expect(signInAction).toHaveBeenCalled();
  });

  it("navega a /panel cuando el onboarding ya está completado", async () => {
    signInAction.mockResolvedValue({ status: "success", redirectTo: "/es/panel" });

    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("/es/panel"));
  });

  it("la acción recibe el FormData real del formulario y el estado inicial", async () => {
    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(signInAction).toHaveBeenCalled());
    const [prevState, formData] = signInAction.mock.calls[0] as [unknown, FormData];
    expect(prevState).toEqual({ status: "idle" });
    expect(formData).toBeInstanceOf(FormData);
  });

  it("un login con error NO navega, muestra el error y el botón vuelve a estar activo (loading termina)", async () => {
    signInAction.mockResolvedValue({
      status: "error",
      message: "actions.auth.signInFailed",
    });

    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText("actions.auth.signInFailed")).toBeInTheDocument(),
    );
    expect(assignMock).not.toHaveBeenCalled();
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(button).not.toBeDisabled();
  });

  it("email no confirmado muestra un mensaje claro y NO navega", async () => {
    signInAction.mockResolvedValue({
      status: "error",
      message: "actions.auth.emailNotConfirmed",
    });

    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText("actions.auth.emailNotConfirmed")).toBeInTheDocument(),
    );
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("si la Server Action lanza una excepción, el botón vuelve a estar activo (nunca loading infinito)", async () => {
    signInAction.mockRejectedValueOnce(new Error("boom"));

    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    const button = screen.getByRole("button");
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "false"));
    expect(button).not.toBeDisabled();
    expect(assignMock).not.toHaveBeenCalled();
  });
});
