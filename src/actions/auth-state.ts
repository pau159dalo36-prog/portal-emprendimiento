export type AuthFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export type AuthFormAction = (
  prevState: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export const initialAuthFormState: AuthFormState = { status: "idle" };
