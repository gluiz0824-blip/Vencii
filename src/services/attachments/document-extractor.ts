import { extractText, getDocumentProxy } from "unpdf";

import {
  decodeBrazilianBankSlip,
  validateBrazilianBarcode,
} from "@/domain/attachments/barcode";
import type {
  AllowedDocumentMimeType,
  DocumentExtractionData,
  ExtractedCandidate,
} from "@/domain/attachments/document";

export interface OcrResult {
  text: string;
}

export interface OcrProvider {
  readonly available: boolean;
  extract(
    bytes: Uint8Array,
    mimeType: AllowedDocumentMimeType,
  ): Promise<OcrResult>;
}

export class UnavailableOcrProvider implements OcrProvider {
  readonly available = false;
  async extract(): Promise<OcrResult> {
    return { text: "" };
  }
}

export interface DocumentExtractor {
  extract(
    bytes: Uint8Array,
    mimeType: AllowedDocumentMimeType,
  ): Promise<DocumentExtractionData>;
}

function candidate(
  value: string | number | undefined,
  confidence: number,
  valid?: boolean,
): ExtractedCandidate | undefined {
  return value === undefined || value === ""
    ? undefined
    : { value, confidence, valid };
}

function brlToCents(value: string): number | undefined {
  const number = Number(value.replace(/\./g, "").replace(",", "."));
  const cents = Math.round(number * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : undefined;
}

function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return undefined;
  const result = `${year}-${month}-${day}`;
  const date = new Date(`${result}T00:00:00Z`);
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
    ? result
    : undefined;
}

function firstDateAfterLabel(text: string, labels: string): string | undefined {
  const match = text.match(
    new RegExp(`(?:${labels})[\\s\\S]{0,80}?(\\d{2}/\\d{2}/\\d{4})`, "i"),
  );
  return isoDate(match?.[1]);
}

function datesInText(text: string): Set<string> {
  return new Set(
    [...text.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)]
      .map((match) => isoDate(match[0]))
      .filter((value): value is string => Boolean(value)),
  );
}

function barcodeCandidatesInText(text: string): string[] {
  const candidates: string[] = [];
  for (const match of text.matchAll(/(?:\d[ .]?){44,64}/g)) {
    const sequence = match[0].replace(/\D/g, "");
    for (const length of [47, 48, 44]) {
      for (let start = 0; start + length <= sequence.length; start += 1)
        candidates.push(sequence.slice(start, start + length));
    }
  }
  return [...new Set(candidates)];
}

export function extractCandidates(
  text: string,
): DocumentExtractionData["candidates"] {
  const normalized = text.replace(/\r/g, "");
  const taxId = normalized.match(
    /\b\d{2}[.]?\d{3}[.]?\d{3}[\/]?\d{4}-?\d{2}\b|\b\d{3}[.]?\d{3}[.]?\d{3}-?\d{2}\b/,
  )?.[0];
  const textualAmount = normalized.match(
    /(?:valor(?:\s+do\s+documento)?|total)\s*[:\-]?\s*R?\$?\s*([\d.]+,\d{2})/i,
  )?.[1];
  const labeledDueDate = firstDateAfterLabel(
    normalized,
    "vencimento|data\\s+de\\s+vencimento",
  );
  const issueDate = firstDateAfterLabel(
    normalized,
    "emiss[aã]o|data\\s+de\\s+emiss[aã]o|data\\s+do\\s+documento",
  );
  const barcodeCandidates = barcodeCandidatesInText(normalized);
  const barcode =
    barcodeCandidates.find((value) => validateBrazilianBarcode(value)) ??
    barcodeCandidates[0];
  const pix = normalized.match(/(?:000201)[A-Za-z0-9 .:/_-]{20,}/)?.[0]?.trim();
  const explicitDocumentNumber = normalized.match(
    /n(?:º|°|o)?\s*(?:do\s+)?documento\s*[:\-]?\s*([\w./-]*\d[\w./-]*)/i,
  )?.[1];
  const structuredDocumentNumber = normalized.match(
    /\b\d{4}\.\d\.\d{4}\.\d{4}-\d\b/,
  )?.[0];
  // Alguns PDFs posicionam a linha digitável logo após "Nº do documento".
  // O identificador estruturado é mais específico e evita essa associação falsa.
  const documentNumber =
    structuredDocumentNumber ??
    (explicitDocumentNumber &&
    explicitDocumentNumber.replace(/\D/g, "").length < 20
      ? explicitDocumentNumber
      : undefined);
  const supplier = normalized
    .match(
      /(?:benefici[aá]rio|cedente|fornecedor)\s*[:\-]?\s*([^\n]{2,120}?)(?=\s+CNPJ\b|\s+CPF\b|\n|$)/i,
    )?.[1]
    ?.trim();
  const validBarcode = barcode ? validateBrazilianBarcode(barcode) : undefined;
  const decoded = barcode ? decodeBrazilianBankSlip(barcode) : null;
  const availableDates = datesInText(normalized);
  const barcodeDueDate = decoded?.dueDateCandidates.find((date) =>
    availableDates.has(date),
  );
  const amountFromText = textualAmount ? brlToCents(textualAmount) : undefined;
  const amountCents = decoded?.amountCents ?? amountFromText;
  const dueDate = labeledDueDate ?? barcodeDueDate;
  return {
    supplierName: candidate(supplier, 0.72),
    taxId: candidate(taxId, 0.84),
    amountCents: candidate(
      amountCents,
      decoded?.amountCents ? 0.98 : 0.88,
      decoded?.amountCents ? true : undefined,
    ),
    issueDate: candidate(issueDate, 0.86),
    dueDate: candidate(
      dueDate,
      labeledDueDate ? 0.92 : barcodeDueDate ? 0.97 : 0,
      barcodeDueDate ? true : undefined,
    ),
    barcode: candidate(barcode, validBarcode ? 0.96 : 0.35, validBarcode),
    pixCode: candidate(pix, 0.7),
    documentNumber: candidate(
      documentNumber,
      structuredDocumentNumber === documentNumber ? 0.84 : 0.78,
    ),
  };
}

export class LocalDocumentExtractor implements DocumentExtractor {
  constructor(
    private readonly ocr: OcrProvider = new UnavailableOcrProvider(),
  ) {}

  async extract(
    bytes: Uint8Array,
    mimeType: AllowedDocumentMimeType,
  ): Promise<DocumentExtractionData> {
    let text = "";
    let pageCount: number | undefined;
    let method: DocumentExtractionData["method"] = "manual";
    if (mimeType === "application/pdf") {
      const pdf = await getDocumentProxy(bytes);
      const extracted = await extractText(pdf, { mergePages: true });
      text = extracted.text.trim();
      pageCount = extracted.totalPages;
      if (text.length >= 20) method = "pdf_text";
    }
    if (text.length < 20 && this.ocr.available) {
      text = (await this.ocr.extract(bytes, mimeType)).text.trim();
      method = "ocr";
    }
    return {
      version: 2,
      method,
      rawText: text.slice(0, 100_000),
      pageCount,
      ocrAvailable: this.ocr.available,
      candidates: extractCandidates(text),
    };
  }
}
