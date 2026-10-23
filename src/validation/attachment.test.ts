import { describe, expect, it } from "vitest";

import {
  decodeBrazilianBankSlip,
  validateBrazilianBarcode,
} from "@/domain/attachments/barcode";
import { extractCandidates } from "@/services/attachments/document-extractor";
import {
  InvalidDocumentError,
  validateDocumentFile,
} from "@/validation/attachment";

function bankBarcode(factor: number, amountCents: number): string {
  const withoutDigit =
    `0019${String(factor).padStart(4, "0")}` +
    `${String(amountCents).padStart(10, "0")}${"0".repeat(25)}`;
  let weight = 2;
  let total = 0;
  for (let index = withoutDigit.length - 1; index >= 0; index -= 1) {
    total += Number(withoutDigit[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const result = 11 - (total % 11);
  const digit = [0, 10, 11].includes(result) ? 1 : result;
  return `${withoutDigit.slice(0, 4)}${digit}${withoutDigit.slice(4)}`;
}

describe("validação de documentos", () => {
  it("aceita PDF quando assinatura, MIME e extensão correspondem", () => {
    const result = validateDocumentFile({
      name: "boleto.pdf",
      claimedMime: "application/pdf",
      bytes: new TextEncoder().encode("%PDF-1.7 arquivo de teste"),
      maximumBytes: 1024,
    });
    expect(result.mimeType).toBe("application/pdf");
  });

  it("recusa extensão disfarçada", () => {
    expect(() =>
      validateDocumentFile({
        name: "boleto.jpg",
        claimedMime: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.7 arquivo de teste"),
        maximumBytes: 1024,
      }),
    ).toThrow(InvalidDocumentError);
  });

  it("recusa arquivo acima do limite", () => {
    expect(() =>
      validateDocumentFile({
        name: "boleto.pdf",
        claimedMime: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.7 arquivo grande"),
        maximumBytes: 4,
      }),
    ).toThrow("ultrapassa");
  });
});

describe("extração assistida", () => {
  it("extrai parcialmente sem inventar campos ausentes", () => {
    const candidates = extractCandidates(
      "Beneficiário: Energia Brasil\nValor do documento: R$ 145,90\nVencimento: 20/08/2026",
    );
    expect(candidates.supplierName?.value).toBe("Energia Brasil");
    expect(candidates.amountCents?.value).toBe(14590);
    expect(candidates.dueDate?.value).toBe("2026-08-20");
    expect(candidates.pixCode).toBeUndefined();
  });

  it("não valida linha digitável apenas pelo tamanho", () => {
    expect(validateBrazilianBarcode("0".repeat(47))).toBe(false);
  });

  it("valida uma linha bancária com dígitos verificadores", () => {
    expect(
      validateBrazilianBarcode(
        "00190500954014481606906809350314337370000000100",
      ),
    ).toBe(true);
  });

  it("decodifica o valor de uma linha bancária válida", () => {
    const decoded = decodeBrazilianBankSlip(
      "00190500954014481606906809350314337370000000100",
    );
    expect(decoded?.amountCents).toBe(100);
  });

  it("decodifica valor e novo fator de vencimento do boleto", () => {
    const decoded = decodeBrazilianBankSlip(bankBarcode(1503, 104_053));
    expect(decoded?.amountCents).toBe(104_053);
    expect(decoded?.dueDateCandidates).toContain("2026-07-10");
  });

  it("associa campos mesmo quando o texto do PDF vem fora da ordem visual", () => {
    const candidates = extractCandidates(
      "Data de Vencimento Valor Cobrado 20/08/2026 0,00 " +
        "Beneficiário: ACME Serviços CNPJ: 12.345.678/0001-90 " +
        "Nº do Documento 00190.50095 Beneficiário 2026.1.0042.0012-3 " +
        "Data do Documento 18/08/2026 " +
        "00190500954014481606906809350314337370000000100",
    );

    expect(candidates.supplierName?.value).toBe("ACME Serviços");
    expect(candidates.amountCents?.value).toBe(100);
    expect(candidates.dueDate?.value).toBe("2026-08-20");
    expect(candidates.issueDate?.value).toBe("2026-08-18");
    expect(candidates.documentNumber?.value).toBe("2026.1.0042.0012-3");
  });
});
