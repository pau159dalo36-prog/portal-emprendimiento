// Test del formulario de login REAL (SignInForm), el mismo componente montado en
// /es/iniciar-sesion. Verifica que, tras un submit correcto, la UI dispara la
// navegación completa (window.location.assign) hacia getPostLoginDestination —
// el mecanismo que descarta el Router Cache anónimo y fuerza un render de
// servidor con la sesión real.
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
// fiablemente en jsdom).
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
    ...props
  }: {
    children?: React.ReactNode;
    pendingText?: string;
  } & Record<string, unknown>) => (
    <button {...props}>{children ?? pendingText}</button>
  ),
}));

// signInAction real se invoca desde el formulario; aquí se mockea para simular
// un login correcto que devuelve el destino post-login.
const { signInAction } = vi.hoisted(() => ({ signInAction: vi.fn() }));
vi.mock("@/actions/auth", () => ({ signInAction }));

import { SignInForm } from "@/components/auth/sign-in-form";
import { initialAuthFormState } from "@/actions/auth-state";

const assignMock = vi.fn();
Object.defineProperty(window, "location", {
  value: { assign: assignMock },
  writable: true,
});

beforeEach(() => {
  signInAction.mockReset();
  assignMock.mockReset();
  signInAction.mockResolvedValue({ status: "success", redirectTo: "/es/panel" });
});

afterEach(() => {
  cleanup();
});

describe("SignInForm (componente de login real)", () => {
  it("tras login correcto navega de forma completa hacia redirectTo (descarta el Router Cache)", async () => {
    render(<SignInForm />);

    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("/es/panel"));
  });

  it("un login fallido NO navega (no hay redirectTo) y muestra el error", async () => {
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

  it("llama a signInAction con el FormData del formulario real", async () => {
    render(<SignInForm />);

    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(signInAction).toHaveBeenCalled());

    const [prevState, formData] = signInAction.mock.calls[0] as [unknown, FormData];
    expect(prevState).toEqual(initialAuthFormState);
    expect(formData).toBeInstanceOf(FormData);
  });
});
