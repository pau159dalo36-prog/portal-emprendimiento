export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  savedStep?: number;
};

export const initialFormState: FormState = { status: "idle" };

export function validationState(
  error: { flatten: () => { fieldErrors: unknown } },
  message: string,
): FormState {
  const { fieldErrors } = error.flatten();
  return {
    status: "error",
    message,
    fieldErrors:
      fieldErrors && typeof fieldErrors === "object"
        ? (fieldErrors as Record<string, string[] | undefined>)
        : undefined,
  };
}
