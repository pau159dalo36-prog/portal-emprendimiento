export type AuthFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialAuthFormState: AuthFormState = { status: "idle" };
