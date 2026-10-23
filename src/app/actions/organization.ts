"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWorkspaceState } from "@/dal/workspace";
import { createFirstOrganization } from "@/repositories/organization-server.repository";
import { getCurrentUser } from "@/services/auth/auth-server.service";
import { setActiveOrganizationId } from "@/services/organization/active-organization.service";
import type { FormState } from "@/validation/form-state";
import { onboardingSchema } from "@/validation/onboarding";

export async function completeOnboardingAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const parsed = onboardingSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName"),
    cnpj: formData.get("cnpj"),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const organizationId = await createFirstOrganization(parsed.data);
    await setActiveOrganizationId(organizationId);
  } catch {
    return {
      status: "error",
      message:
        "Não foi possível concluir o onboarding. Revise os dados e tente novamente.",
    };
  }

  redirect("/app");
}

export async function switchOrganizationAction(
  formData: FormData,
): Promise<void> {
  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string") return;

  const state = await getWorkspaceState();
  if (
    !state.organizations.some(
      (organization) => organization.id === organizationId,
    )
  ) {
    throw new Error("Organização não autorizada.");
  }

  await setActiveOrganizationId(organizationId);
  revalidatePath("/app", "layout");
  redirect("/app");
}
