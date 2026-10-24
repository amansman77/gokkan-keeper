import type { ImportScreenKind, OcrLine, OcrPage } from '@gokkan-keeper/shared';
import { readAmount } from './numbers';

/**
 * Samsung Securities (mPOP) screen readers. OCR text order is unreliable, so
 * rows and columns are rebuilt from line boxes rather than from reading order.
 */

export const cy = (l: OcrLine) => (l.box[1] + l.box[3]) / 2;
const has = (page: OcrPage, pattern: RegExp) => page.lines.some((l) => pattern.test(l.text));

export function classifyScreen(page: OcrPage): ImportScreenKind {
  const overseas = has(page, /해외주식잔고/);
  if (overseas && has(page, /종목코드/)) return 'us-holdings';
  if (has(page, /원화환산금액/) && has(page, /외화잔고/)) return 'us-cash';
  if (!overseas && has(page, /당일현금|D\+2\s*현금/)) return 'kr-cash';
  if (!overseas && has(page, /주식잔고/) && has(page, /종목명/) && has(page, /평가금액/)) return 'kr-holdings';
  return 'unknown';
}

/** Last four digits of the account number printed under the title ("…1216-01"). */
export function accountSuffix(page: OcrPage): string | null {
  for (const l of page.lines) {
    const match = l.text.match(/(\d{10})-\d{2}/);
    if (match) return match[1].slice(-4);
  }
  return null;
}

/** The value printed on the same row as a label, to its right. */
export function valueBeside(page: OcrPage, label: OcrLine): OcrLine | null {
  const row = page.lines.filter((l) => l !== label && l.box[0] > label.box[2] && Math.abs(cy(l) - cy(label)) < 30 && /\d/.test(l.text));
  return row.sort((a, b) => a.box[0] - b.box[0])[0] ?? null;
}

function firstLabel(page: OcrPage, pattern: RegExp, maxX = Infinity): OcrLine | null {
  return page.lines.filter((l) => pattern.test(l.text.trim()) && l.box[0] < maxX).sort((a, b) => a.box[1] - b.box[1])[0] ?? null;
}

export interface HeaderTotals {
  profitLoss: { value: number; repaired: boolean } | null;
  marketValue: { value: number; repaired: boolean } | null;
}

export function headerTotals(page: OcrPage, currency: 'KRW' | 'USD'): HeaderTotals {
  const plLabel = firstLabel(page, /^평가손익$/);
  const plLine = plLabel && valueBeside(page, plLabel);
  // the won total shares its line with the percentage ("-287,463원 -5.97%")
  const plText = plLine ? (plLine.text.match(/-?[\d.,]+\s*원/)?.[0] ?? plLine.text.split(/\s+/)[0]) : null;
  const mvLabel = currency === 'USD' ? firstLabel(page, /^주식평가금액$/) : null;
  const mvLine = mvLabel && valueBeside(page, mvLabel);
  return {
    profitLoss: plText ? readAmount(plText, currency) : null,
    marketValue: mvLine ? readAmount(mvLine.text, currency) : null,
  };
}

export function cashAmount(page: OcrPage, kind: ImportScreenKind): number | null {
  const label = kind === 'kr-cash'
    ? firstLabel(page, /^D\+2\s*현금$/) ?? firstLabel(page, /^당일현금$/)
    : firstLabel(page, /^외화잔고$/, page.width * 0.15);
  const line = label && valueBeside(page, label);
  if (!line) return null;
  return readAmount(line.text, kind === 'kr-cash' ? 'KRW' : 'USD')?.value ?? null;
}
