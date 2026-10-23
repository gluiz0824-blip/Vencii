import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CurrencyDisplay } from "@/components/product/currency-display";
import { DateDisplay } from "@/components/product/date-display";
import { PermissionGuard } from "@/components/product/permission-guard";
import {
  StatusBadge,
  type FinancialStatus,
} from "@/components/product/status-badge";
import { businessDate } from "@/domain/shared/business-date";
import { moneyInCents } from "@/domain/shared/money";

describe("componentes de apresentação financeira", () => {
  it("formata moeda e data com os contratos do domínio", () => {
    const markup = renderToStaticMarkup(
      <>
        <CurrencyDisplay value={moneyInCents(123456)} />
        <DateDisplay value={businessDate("2026-07-15")} />
      </>,
    );

    expect(markup).toContain("R$ 1.234,56");
    expect(markup).toContain('dateTime="2026-07-15"');
    expect(markup).toContain("15/07/2026");
  });

  it("sempre acompanha o status por texto e ícone", () => {
    const statuses: Array<[FinancialStatus, string]> = [
      ["pending", "Pendente"],
      ["awaiting_approval", "Aguardando aprovação"],
      ["approved", "Aprovado"],
      ["paid", "Pago"],
      ["overdue", "Vencido"],
      ["canceled", "Cancelado"],
      ["rejected", "Rejeitado"],
    ];

    for (const [status, label] of statuses) {
      expect(renderToStaticMarkup(<StatusBadge status={status} />)).toContain(
        label,
      );
    }
  });

  it("renderiza conteúdo apenas para papéis autorizados", () => {
    const allowed = renderToStaticMarkup(
      <PermissionGuard role="admin" allowed={["owner", "admin"]}>
        <span>Permitido</span>
      </PermissionGuard>,
    );
    const blocked = renderToStaticMarkup(
      <PermissionGuard
        role="viewer"
        allowed={["owner", "admin"]}
        fallback={<span>Bloqueado</span>}
      >
        <span>Permitido</span>
      </PermissionGuard>,
    );

    expect(allowed).toContain("Permitido");
    expect(blocked).toContain("Bloqueado");
    expect(blocked).not.toContain("Permitido");
  });
});
