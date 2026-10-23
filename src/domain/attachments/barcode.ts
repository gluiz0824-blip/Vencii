function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function modulo10(value: string): number {
  let factor = 2;
  let total = 0;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const product = Number(value[index]) * factor;
    total += product > 9 ? Math.floor(product / 10) + (product % 10) : product;
    factor = factor === 2 ? 1 : 2;
  }
  return (10 - (total % 10)) % 10;
}

function modulo11Bank(value: string): number {
  let factor = 2;
  let total = 0;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    total += Number(value[index]) * factor;
    factor = factor === 9 ? 2 : factor + 1;
  }
  const result = 11 - (total % 11);
  return result === 0 || result === 10 || result === 11 ? 1 : result;
}

function modulo11Utility(value: string): number {
  let factor = 2;
  let total = 0;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    total += Number(value[index]) * factor;
    factor = factor === 9 ? 2 : factor + 1;
  }
  const remainder = total % 11;
  return remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
}

function validateBankLine(line: string): boolean {
  if (line.length !== 47) return false;
  if (
    modulo10(line.slice(0, 9)) !== Number(line[9]) ||
    modulo10(line.slice(10, 20)) !== Number(line[20]) ||
    modulo10(line.slice(21, 31)) !== Number(line[31])
  )
    return false;
  const barcode = `${line.slice(0, 4)}${line[32]}${line.slice(33, 47)}${line.slice(4, 9)}${line.slice(10, 20)}${line.slice(21, 31)}`;
  return (
    modulo11Bank(barcode.slice(0, 4) + barcode.slice(5)) === Number(barcode[4])
  );
}

function validateBankBarcode(barcode: string): boolean {
  return (
    barcode.length === 44 &&
    modulo11Bank(barcode.slice(0, 4) + barcode.slice(5)) === Number(barcode[4])
  );
}

function validateUtility(value: string): boolean {
  if (value.length === 44) {
    const calculator =
      value[2] === "6" || value[2] === "7" ? modulo10 : modulo11Utility;
    return calculator(value.slice(0, 3) + value.slice(4)) === Number(value[3]);
  }
  if (value.length !== 48) return false;
  const calculator =
    value[2] === "6" || value[2] === "7" ? modulo10 : modulo11Utility;
  return [0, 12, 24, 36].every((start) => {
    const block = value.slice(start, start + 12);
    return calculator(block.slice(0, 11)) === Number(block[11]);
  });
}

export function validateBrazilianBarcode(value: string): boolean {
  const normalized = digits(value);
  if (normalized.startsWith("8")) return validateUtility(normalized);
  return validateBankLine(normalized) || validateBankBarcode(normalized);
}

export interface DecodedBankSlip {
  amountCents?: number;
  dueDateCandidates: string[];
}

function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Decodifica apenas boletos bancários validados (linha de 47 dígitos ou
 * código de barras de 44). Concessionárias possuem outra semântica de valor.
 */
export function decodeBrazilianBankSlip(value: string): DecodedBankSlip | null {
  const normalized = digits(value);
  if (
    normalized.startsWith("8") ||
    !validateBrazilianBarcode(normalized) ||
    ![44, 47].includes(normalized.length)
  )
    return null;

  const factor = Number(
    normalized.length === 47
      ? normalized.slice(33, 37)
      : normalized.slice(5, 9),
  );
  const encodedAmount = Number(
    normalized.length === 47
      ? normalized.slice(37, 47)
      : normalized.slice(9, 19),
  );
  const dueDateCandidates: string[] = [];
  if (factor > 0) {
    dueDateCandidates.push(addUtcDays("1997-10-07", factor));
    if (factor >= 1000)
      dueDateCandidates.push(addUtcDays("2025-02-22", factor - 1000));
  }
  return {
    amountCents: encodedAmount > 0 ? encodedAmount : undefined,
    dueDateCandidates: [...new Set(dueDateCandidates)],
  };
}
