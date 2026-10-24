import type { OcrLine, OcrPage } from '@gokkan-keeper/shared';
import { cy } from './layout';
import { isPercentText, readAmount, readPercent, readQuantity } from './numbers';

/**
 * Holding rows on Samsung's 주식잔고/해외주식잔고 lists. Each holding is a
 * two-line block: name (and, overseas, ticker) on the left, profit/loss over
 * return in the middle, quantity over market value on the right.
 */

export interface RawHolding {
  name: string;
  ticker: string | null;
  /** null when OCR dropped the (often single-digit) count; reconcile infers it */
  quantity: number | null;
  marketValue: number;
  profitLoss: number;
  profitLossPercent: number;
  repaired: boolean;
}

const FOOTER = /^(KOSPI|KOSDAQ|중국상해|다우존스|나스닥|S&P)|장종료|관심종목/;
const TICKER = /^[A-Z][A-Z0-9.-]{0,9}$/;

function listBounds(page: OcrPage): [number, number] | null {
  const headers = page.lines.filter((l) => /^(종목명|종목코드|수익률|평가금액)$/.test(l.text.trim()));
  if (!headers.length) return null;
  const top = Math.max(...headers.map((l) => l.box[3]));
  const footer = page.lines.filter((l) => l.box[1] > top && FOOTER.test(l.text.trim())).sort((a, b) => a.box[1] - b.box[1])[0];
  return [top, footer ? footer.box[1] : page.height];
}

interface Columns { left: OcrLine[]; middle: OcrLine[]; right: OcrLine[] }

function columns(page: OcrPage, [top, bottom]: [number, number]): Columns {
  const inList = page.lines.filter((l) => l.box[1] >= top && l.box[3] <= bottom);
  const w = page.width;
  return {
    left: inList.filter((l) => l.box[0] < 0.4 * w && l.box[2] < 0.55 * w),
    middle: inList.filter((l) => l.box[2] >= 0.55 * w && l.box[2] <= 0.75 * w),
    right: inList.filter((l) => l.box[2] > 0.8 * w),
  };
}

const nearest = (lines: OcrLine[], y: number) =>
  lines.map((l) => ({ l, d: Math.abs(cy(l) - y) })).filter((x) => x.d < 35).sort((a, b) => a.d - b.d)[0]?.l ?? null;

function nameOf(left: OcrLine[], range: [number, number], withTicker: boolean): { name: string; ticker: string | null } | null {
  const lines = left.filter((l) => cy(l) >= range[0] && cy(l) <= range[1]).sort((a, b) => a.box[1] - b.box[1]);
  if (!lines.length) return null;
  const last = lines[lines.length - 1].text.trim();
  // only the overseas list prints a ticker line; a wrapped Korean ETF name
  // can end in capitals ("…로보틱스 IN" + "DXX") and must stay in the name
  const ticker = withTicker && lines.length > 1 && TICKER.test(last) ? last : null;
  const parts = (ticker ? lines.slice(0, -1) : lines).map((l) => l.text.trim());
  // a wrapped English name continues mid-word ("…Dividend Y" + "ield ETF")
  const name = parts.reduce((acc, p) => (acc && /[a-z]$/i.test(acc) && /^[a-z]/.test(p) ? acc + p : acc ? `${acc} ${p}` : p), '');
  return { name, ticker };
}

export function readHoldings(page: OcrPage, currency: 'KRW' | 'USD'): RawHolding[] {
  const bounds = listBounds(page);
  if (!bounds) return [];
  const { left, middle, right } = columns(page, bounds);
  const mids = [...middle].sort((a, b) => a.box[1] - b.box[1]);
  const rows: RawHolding[] = [];
  for (let i = 0; i < mids.length - 1; i++) {
    const plLine = mids[i];
    const pctLine = mids[i + 1];
    if (isPercentText(plLine.text) || !isPercentText(pctLine.text) || cy(pctLine) - cy(plLine) > 120) continue;
    const row = readRow({ left, right, plLine, pctLine }, currency);
    if (row) rows.push(row);
    i++;
  }
  return rows;
}

function readRow(
  block: { left: OcrLine[]; right: OcrLine[]; plLine: OcrLine; pctLine: OcrLine },
  currency: 'KRW' | 'USD',
): RawHolding | null {
  const { left, right, plLine, pctLine } = block;
  const qtyLine = nearest(right, cy(plLine));
  const mvLine = nearest(right, cy(pctLine));
  const pl = readAmount(plLine.text, currency);
  const pct = readPercent(pctLine.text);
  const mv = mvLine && readAmount(mvLine.text, currency);
  const quantity = qtyLine && readQuantity(qtyLine.text);
  const label = nameOf(left, [plLine.box[1] - 45, pctLine.box[3] + 10], currency === 'USD');
  if (!pl || pct === null || !mv || !label) return null;
  return {
    ...label, quantity: quantity ?? null, marketValue: mv.value, profitLoss: pl.value, profitLossPercent: pct,
    repaired: pl.repaired || mv.repaired,
  };
}
