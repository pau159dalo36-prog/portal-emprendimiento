export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  savedStep?: number;
};

export const initialFormState: FormState = { status: "idle" };

export function validationState(
  error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } },
  message: string,
): FormState {
  return {
    status: "error",
    message,
    fieldErrors: error.flatten().fieldErrors,
  };
}
