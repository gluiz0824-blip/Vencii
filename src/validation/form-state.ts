export interface FormState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const INITIAL_FORM_STATE: FormState = { status: "idle" };
