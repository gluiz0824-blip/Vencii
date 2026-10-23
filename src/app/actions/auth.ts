"use server";

import { redirect } from "next/navigation";

import { getAppUrl } from "@/config/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { findActiveOrganizations } from "@/repositories/organization-server.repository";
import { getSignUpErrorMessage } from "@/services/auth/auth-error.service";
import {
  getActiveOrganizationId,
  setActiveOrganizationId,
} from "@/services/organization/active-organization.service";
import {
  passwordRecoverySchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/validation/auth";
import type { FormState } from "@/validation/form-state";

function invalidState(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}): FormState {
  return { status: "error", fieldErrors: error.flatten().fieldErrors };
}

export async function signInAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return invalidState(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { status: "error", message: "E-mail ou senha incorretos." };
  }

  const organizations = await findActiveOrganizations(data.user.id);
  if (organizations.length === 0) redirect("/onboarding");

  const activeOrganizationId = await getActiveOrganizationId();
  if (
    activeOrganizationId &&
    organizations.some(({ id }) => id === activeOrganizationId)
  ) {
    redirect("/app");
  }

  if (organizations.length === 1 && organizations[0]) {
    await setActiveOrganizationId(organizations[0].id);
    redirect("/app");
  }

  redirect("/selecionar-organizacao");
}

export async function signUpAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) return invalidState(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getAppUrl()}/auth/confirm?next=/onboarding`,
    },
  });

  if (error) {
    console.error("[auth.signup] Supabase recusou o cadastro", {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    return {
      status: "error",
      message: getSignUpErrorMessage(error),
    };
  }

  if (data.session) redirect("/onboarding");

  return {
    status: "success",
    message: "Conta criada. Confirme seu e-mail para continuar o onboarding.",
  };
}

export async function requestPasswordResetAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = passwordRecoverySchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return invalidState(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${getAppUrl()}/auth/confirm?next=/redefinir-senha`,
    },
  );

  if (error) {
    return {
      status: "error",
      message: "Não foi possível enviar o e-mail agora.",
    };
  }

  return {
    status: "success",
    message:
      "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.",
  };
}

export async function updatePasswordAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) return invalidState(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    return {
      status: "error",
      message: "Não foi possível atualizar sua senha.",
    };

  redirect("/app");
}
