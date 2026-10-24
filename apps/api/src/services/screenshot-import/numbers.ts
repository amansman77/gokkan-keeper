/**
 * Number reading for OCR'd broker screens. OCR confuses separators and picks up
 * stray glyphs (a scrollbar beside the right column reads as a trailing "1"),
 * so each reader accepts only the broker's own format and reports when it had
 * to repair a value. Every repaired value still has to pass the total checks.
 */

export interface ReadNumber {
  value: number;
  repaired: boolean;
}

const KRW = /^-?\d{1,3}(?:,\d{3})*$/;
const USD = /^-?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?$/;

function clean(raw: string): string {
  return raw.replace(/[\s원]/g, '').replace(/(?:USD|usd|uso|US)$/i, '').replace(/^[−–]/, '-');
}

/** Won amounts are whole numbers in comma groups; a period is a misread comma. */
export function readKrw(raw: string): ReadNumber | null {
  const text = clean(raw).replace(/\./g, ',');
  if (KRW.test(text)) return { value: Number(text.replace(/,/g, '')), repaired: text !== clean(raw) };
  if (/^-?\d{1,3}$/.test(text)) return { value: Number(text), repaired: false };
  // one stray trailing glyph breaks the last group (e.g. "15,1551")
  const trimmed = text.slice(0, -1);
  if (text.length > 4 && KRW.test(trimmed)) return { value: Number(trimmed.replace(/,/g, '')), repaired: true };
  return null;
}

/** Dollar amounts on Samsung's overseas screen carry two to four decimals. */
export function readUsd(raw: string, maxDecimals = 4): ReadNumber | null {
  const text = clean(raw);
  if (!USD.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const kept = fraction.slice(0, maxDecimals);
  const value = Number(`${whole.replace(/,/g, '')}${kept ? `.${kept}` : ''}`);
  return Number.isFinite(value) ? { value, repaired: fraction.length > maxDecimals } : null;
}

export function readAmount(raw: string, currency: 'KRW' | 'USD'): ReadNumber | null {
  return currency === 'KRW' ? readKrw(raw) : readUsd(raw);
}

/** "-21.98%" → -21.98. Values without a decimal point are rejected as misreads. */
export function readPercent(raw: string): number | null {
  const match = clean(raw).match(/^(-?\d+\.\d+)%$/);
  return match ? Number(match[1]) : null;
}

/** Share counts: whole numbers, or fractional shares as Toss and Samsung print them. */
export function readQuantity(raw: string): number | null {
  const text = clean(raw).replace(/주$/, '');
  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
}

export const isPercentText = (raw: string): boolean => /%\s*$/.test(raw);
