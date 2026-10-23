"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import {
  createApprovalRuleAction,
  type ApprovalActionState,
} from "@/app/actions/approvals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LookupOption } from "@/repositories/accounts-payable-server.repository";

const initialState: ApprovalActionState = { status: "idle" };

export function ApprovalRuleForm({
  suppliers,
  categories,
}: {
  suppliers: LookupOption[];
  categories: LookupOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createApprovalRuleAction,
    initialState,
  );
  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nome da regra"
          htmlFor="rule-name"
          className="sm:col-span-2"
        >
          <Input
            id="rule-name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="Ex.: Compras acima de R$ 5.000"
          />
        </Field>
        <Field label="Valor mínimo" htmlFor="rule-min">
          <Input
            id="rule-min"
            name="minAmount"
            inputMode="decimal"
            placeholder="0,00"
          />
        </Field>
        <Field label="Valor máximo" htmlFor="rule-max">
          <Input
            id="rule-max"
            name="maxAmount"
            inputMode="decimal"
            placeholder="Sem limite"
          />
        </Field>
        <Field label="Categoria" htmlFor="rule-category">
          <select
            id="rule-category"
            name="categoryId"
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
          >
            <option value="">Todas as categorias</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fornecedor" htmlFor="rule-supplier">
          <select
            id="rule-supplier"
            name="supplierId"
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
          >
            <option value="">Todos os fornecedores</option>
            {suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aprovações necessárias" htmlFor="rule-count">
          <Input
            id="rule-count"
            name="requiredApprovals"
            type="number"
            min={1}
            max={10}
            defaultValue={1}
            required
          />
        </Field>
        <Field label="Prioridade" htmlFor="rule-priority">
          <Input
            id="rule-priority"
            name="priority"
            type="number"
            min={0}
            max={1000}
            defaultValue={0}
            required
          />
        </Field>
      </div>
      <p className="text-muted-foreground text-xs leading-5">
        Regras com mais critérios específicos vencem primeiro. Em caso de
        empate, a maior prioridade é aplicada.
      </p>
      {state.message && (
        <p
          role="status"
          className={
            state.status === "error"
              ? "text-destructive text-sm"
              : "text-status-paid-foreground text-sm"
          }
        >
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        <Plus /> {pending ? "Criando..." : "Criar regra"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
