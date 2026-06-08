const EURO_AMOUNT_PATTERN = /^(\d+)(?:[.,](\d{1,2}))?$/;

function parseDigits(value: string): number | null {
  let result = 0;

  for (let index = 0; index < value.length; index += 1) {
    const digit = value.charCodeAt(index) - 48;

    if (digit < 0 || digit > 9) {
      return null;
    }

    const nextResultLimit = Math.floor((Number.MAX_SAFE_INTEGER - digit) / 10);

    if (result > nextResultLimit) {
      return null;
    }

    result = result * 10 + digit;
  }

  return result;
}

export function eurosToCents(value: string): number | null {
  const trimmedValue = value.trim();
  const match = EURO_AMOUNT_PATTERN.exec(trimmedValue);

  if (match === null) {
    return null;
  }

  const wholePart = parseDigits(match[1]);

  if (wholePart === null) {
    return null;
  }

  const fractionPart = parseDigits((match[2] ?? '').padEnd(2, '0'));

  if (fractionPart === null) {
    return null;
  }

  if (wholePart > Math.floor((Number.MAX_SAFE_INTEGER - fractionPart) / 100)) {
    return null;
  }

  const cents = wholePart * 100 + fractionPart;

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return null;
  }

  return cents;
}

export function centsToEuros(cents: number): string {
  if (!Number.isFinite(cents)) {
    return '0.00';
  }

  const normalizedCents = Math.trunc(cents);
  const absoluteCents = Math.abs(normalizedCents);
  const euros = Math.floor(absoluteCents / 100);
  const remainder = absoluteCents % 100;
  const formatted = `${euros}.${remainder.toString().padStart(2, '0')}`;

  return normalizedCents < 0 ? `-${formatted}` : formatted;
}

export function isPositiveCentAmount(cents: number): boolean {
  return Number.isInteger(cents) && cents > 0;
}