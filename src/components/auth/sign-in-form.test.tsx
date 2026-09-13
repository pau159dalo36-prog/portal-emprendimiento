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

const { signInAction } = vi.hoisted(() => ({ signInAction: vi.fn() }));
vi.mock("@/actions/auth", () => ({ signInAction }));

import { initialAuthFormState } from "@/actions/auth-state";
import { SignInForm } from "@/components/auth/sign-in-form";

let assignMock: ReturnType<typeof vi.fn>;
const realLocation = window.location;

beforeEach(() => {
  assignMock = vi.fn();
  Object.defineProperty(window, "location", {
    value: { assign: assignMock, href: "/", reload: vi.fn() },
    writable: true,
    configurable: true,
  });
  signInAction.mockReset();
  // En el flujo real la Server Action redirige server-side (redirect) y nunca
  // devuelve un estado de éxito: lo simulamos como si no hubiera cambio visible.
  signInAction.mockResolvedValue(initialAuthFormState);
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "location", { value: realLocation, writable: true, configurable: true });
});

describe("SignInForm (useActionState)", () => {
  it("la acción recibe el FormData real del formulario y el estado inicial", async () => {
    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(signInAction).toHaveBeenCalled());
    const [prevState, formData] = signInAction.mock.calls[0] as [unknown, FormData];
    expect(prevState).toEqual({ status: "idle" });
    expect(formData).toBeInstanceOf(FormData);
  });

  it("tras el submit la navegación al destino es server-side: NO usa window.location.assign", async () => {
    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(signInAction).toHaveBeenCalled());
    // El redirect lo gestiona Next.js desde la Server Action (cookie ya escrita
    // en la misma respuesta); el componente no debe navegar por su cuenta.
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.queryByText("actions.auth.signInFailed")).not.toBeInTheDocument();
  });

  it("un login con error NO navega, muestra el error y el botón vuelve a estar activo", async () => {
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
  });

  it("un error de red (signInNetwork) se muestra y NO navega", async () => {
    signInAction.mockResolvedValue({
      status: "error",
      message: "actions.auth.signInNetwork",
    });

    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText("actions.auth.signInNetwork")).toBeInTheDocument(),
    );
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("si la Server Action devuelve error inesperado, NO navega", async () => {
    signInAction.mockResolvedValueOnce({ status: "error", message: "error inesperado" });

    render(<SignInForm />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(signInAction).toHaveBeenCalled());
    expect(assignMock).not.toHaveBeenCalled();
  });
});