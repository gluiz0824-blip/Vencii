import { UsersRound } from "lucide-react";
import type { Metadata } from "next";

import { ModuleEmptyPage } from "@/components/product/module-empty-page";

export const metadata: Metadata = { title: "Fornecedores" };

export default function SuppliersPage() {
  return (
    <ModuleEmptyPage
      title="Fornecedores"
      description="Parceiros serão mantidos dentro da organização ativa e vinculados aos compromissos correspondentes."
      emptyTitle="Nenhum fornecedor cadastrado"
      emptyDescription="O cadastro será disponibilizado junto ao módulo de fornecedores, sem dados demonstrativos no ambiente real."
      icon={UsersRound}
    />
  );
}
