import type { Json } from "@/types/database";

export const ATTACHMENT_BUCKET = "payable-documents";
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export type AllowedDocumentMimeType =
  (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export type ExtractedFieldName =
  | "supplierName"
  | "taxId"
  | "amountCents"
  | "issueDate"
  | "dueDate"
  | "barcode"
  | "pixCode"
  | "documentNumber";

export interface ExtractedCandidate {
  value: string | number;
  confidence: number;
  valid?: boolean;
}

export interface DocumentExtractionData {
  version: 1 | 2;
  method: "pdf_text" | "ocr" | "manual";
  rawText: string;
  pageCount?: number;
  ocrAvailable: boolean;
  candidates: Partial<Record<ExtractedFieldName, ExtractedCandidate>>;
}

export function extractionDataToJson(data: DocumentExtractionData): Json {
  return data as unknown as Json;
}
