import "server-only";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type { OrganizationRole } from "@/types/database";

export interface OrganizationSummary {
  id: string;
  legalName: string;
  tradeName: string;
  timezone: string;
  currency: string;
  allowSelfApproval: boolean;
  allowPartialPayments: boolean;
  allowOverpayments: boolean;
  overpaymentToleranceCents: number;
  role: OrganizationRole;
}

export async function findActiveOrganizations(
  userId: string,
): Promise<OrganizationSummary[]> {
  const supabase = await createSupabaseServerClient();
  const [
    { data: organizations, error: organizationsError },
    { data: memberships, error: membershipsError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, legal_name, trade_name, timezone, currency, allow_self_approval, allow_partial_payments, allow_overpayments, overpayment_tolerance_cents",
      )
      .order("trade_name"),
    supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  if (organizationsError || membershipsError) {
    throw new Error("Não foi possível carregar as organizações do usuário.");
  }

  const roles = new Map(
    memberships.map((membership) => [
      membership.organization_id,
      membership.role,
    ]),
  );

  return organizations.flatMap((organization) => {
    const role = roles.get(organization.id);
    return role
      ? [
          {
            id: organization.id,
            legalName: organization.legal_name,
            tradeName: organization.trade_name,
            timezone: organization.timezone,
            currency: organization.currency,
            allowSelfApproval: organization.allow_self_approval,
            allowPartialPayments: organization.allow_partial_payments,
            allowOverpayments: organization.allow_overpayments,
            overpaymentToleranceCents: organization.overpayment_tolerance_cents,
            role,
          },
        ]
      : [];
  });
}

export async function createFirstOrganization(input: {
  fullName: string;
  phone: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  timezone: string;
  currency: "BRL";
}): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("complete_onboarding", {
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_legal_name: input.legalName,
    p_trade_name: input.tradeName,
    p_cnpj: input.cnpj,
    p_timezone: input.timezone,
    p_currency: input.currency,
  });

  if (error) throw new Error(error.message);
  return data;
}
