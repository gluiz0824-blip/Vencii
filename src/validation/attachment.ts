import { z } from "zod";

import type { AllowedDocumentMimeType } from "@/domain/attachments/document";

const EXTENSIONS: Record<AllowedDocumentMimeType, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
};

export class InvalidDocumentError extends Error {}

export function sanitizeOriginalName(name: string): string {
  const leaf = name.split(/[\\/]/).at(-1) ?? "documento";
  return (
    leaf.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "documento"
  );
}

function detectedMime(bytes: Uint8Array): AllowedDocumentMimeType | null {
  if (
    bytes.length >= 5 &&
    new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
  )
    return "application/pdf";
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  return null;
}

export function validateDocumentFile(input: {
  name: string;
  claimedMime: string;
  bytes: Uint8Array;
  maximumBytes: number;
}): {
  mimeType: AllowedDocumentMimeType;
  extension: string;
  originalName: string;
} {
  if (input.bytes.length === 0)
    throw new InvalidDocumentError("O arquivo está vazio.");
  if (input.bytes.length > input.maximumBytes)
    throw new InvalidDocumentError("O arquivo ultrapassa o limite permitido.");
  const mimeType = detectedMime(input.bytes);
  if (!mimeType)
    throw new InvalidDocumentError(
      "O conteúdo do arquivo não é PDF, PNG ou JPEG válido.",
    );
  if (input.claimedMime && input.claimedMime !== mimeType)
    throw new InvalidDocumentError(
      "O tipo informado não corresponde ao conteúdo do arquivo.",
    );
  const originalName = sanitizeOriginalName(input.name);
  const extension = originalName.toLocaleLowerCase().split(".").at(-1) ?? "";
  if (!EXTENSIONS[mimeType].includes(extension))
    throw new InvalidDocumentError(
      "A extensão não corresponde ao conteúdo do arquivo.",
    );
  return { mimeType, extension, originalName };
}

export const attachmentReviewSchema = z.object({
  mode: z.enum(["existing", "new"]),
  accountPayableId: z.union([z.literal(""), z.uuid()]),
  description: z.string().trim().min(2).max(240),
  supplierName: z.string().trim().max(240),
  taxId: z.string().trim().max(20),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/),
  issueDate: z.union([z.literal(""), z.iso.date()]),
  dueDate: z.iso.date(),
  barcode: z.string().trim().max(160),
  pixCode: z.string().trim().max(1000),
  documentNumber: z.string().trim().max(120),
});
