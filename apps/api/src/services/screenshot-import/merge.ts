import type { ImportCheck, ImportScreenKind, ImportWarning, OcrPage } from '@gokkan-keeper/shared';
import { readHoldings, type RawHolding } from './holdings';
import { accountSuffix, cashAmount, classifyScreen, headerTotals } from './layout';

/**
 * Combines every screenshot of one upload into a single reading for the
 * granary's currency, and runs the checks that decide whether it may be applied.
 */

export interface MergedHolding extends RawHolding { pages: number[] }

export interface MergedReading {
  currency: 'KRW' | 'USD';
  accountSuffixes: string[];
  holdings: MergedHolding[];
  cash: number | null;
  totals: { profitLoss: number | null; marketValue: number | null };
  checks: ImportCheck[];
  warnings: ImportWarning[];
}

const KINDS: Record<'KRW' | 'USD', [ImportScreenKind, ImportScreenKind]> = {
  KRW: ['kr-holdings', 'kr-cash'],
  USD: ['us-holdings', 'us-cash'],
};

/** Overlapping screenshots repeat rows; names are the least reliable field, so
 *  a row is identified by its numbers. */
const rowKey = (h: RawHolding) => `${h.marketValue}|${h.profitLoss}|${h.profitLossPercent}`;

function mostCommon(values: number[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const fmt = (n: number, currency: 'KRW' | 'USD') =>
  currency === 'KRW' ? `${Math.round(n).toLocaleString('ko-KR')}원` : `$${n.toFixed(2)}`;

export function mergePages(pages: OcrPage[], currency: 'KRW' | 'USD'): MergedReading {
  const [holdingKind, cashKind] = KINDS[currency];
  const warnings: ImportWarning[] = [];
  const holdings = new Map<string, MergedHolding>();
  const plTotals: number[] = [];
  const mvTotals: number[] = [];
  const cashes: number[] = [];
  const suffixes = new Set<string>();
  const ignored: number[] = [];

  for (const page of pages) {
    const kind = classifyScreen(page);
    if (kind !== holdingKind && kind !== cashKind) { ignored.push(page.seq); continue; }
    const suffix = accountSuffix(page);
    if (suffix) suffixes.add(suffix);
    if (kind === cashKind) {
      const cash = cashAmount(page, kind);
      if (cash !== null) cashes.push(cash);
      continue;
    }
    const totals = headerTotals(page, currency);
    if (totals.profitLoss) plTotals.push(totals.profitLoss.value);
    if (totals.marketValue) mvTotals.push(totals.marketValue.value);
    for (const row of readHoldings(page, currency)) {
      const existing = holdings.get(rowKey(row));
      if (existing) { existing.pages.push(page.seq); existing.quantity ??= row.quantity; continue; }
      holdings.set(rowKey(row), { ...row, pages: [page.seq] });
      if (row.repaired) warnings.push({ code: 'repaired_number', detail: `${row.name}: 숫자 표기를 보정해 읽었어요` });
    }
  }
  if (ignored.length) warnings.push({ code: 'ignored_pages', detail: `이 곳간 통화와 맞지 않거나 알 수 없는 화면 ${ignored.length}장(${ignored.join(', ')}번)은 제외했어요` });

  const rows = [...holdings.values()];
  const totals = { profitLoss: mostCommon(plTotals), marketValue: mostCommon(mvTotals) };
  const cash = mostCommon(cashes);
  return {
    currency, accountSuffixes: [...suffixes], holdings: rows, cash, totals,
    checks: totalChecks(rows, totals, currency, cash), warnings,
  };
}

function totalChecks(
  rows: MergedHolding[],
  totals: { profitLoss: number | null; marketValue: number | null },
  currency: 'KRW' | 'USD',
  cash: number | null,
): ImportCheck[] {
  const tolerance = currency === 'KRW' ? 1 : 0.011;
  const plSum = rows.reduce((s, r) => s + r.profitLoss, 0);
  const mvSum = rows.reduce((s, r) => s + r.marketValue, 0);
  const checks: ImportCheck[] = [];
  checks.push(totals.profitLoss === null
    ? { code: 'profit_loss_total', passed: false, detail: '화면 상단의 평가손익 합계를 읽지 못했어요' }
    : Math.abs(plSum - totals.profitLoss) <= tolerance
      ? { code: 'profit_loss_total', passed: true, detail: `종목 ${rows.length}개의 손익 합계가 화면 합계 ${fmt(totals.profitLoss, currency)}와 같아요` }
      : { code: 'profit_loss_total', passed: false, detail: `종목 손익 합계 ${fmt(plSum, currency)}가 화면 합계 ${fmt(totals.profitLoss, currency)}와 ${fmt(Math.abs(plSum - totals.profitLoss), currency)} 달라요. 빠진 스크린샷이나 잘못 읽은 종목이 있어요` });
  // the overseas screen prints a market-value total; without it, omitted rows
  // whose profits and losses cancel would slip past the profit/loss check
  if (totals.marketValue !== null) {
    const ok = Math.abs(mvSum - totals.marketValue) <= tolerance;
    checks.push({ code: 'market_value_total', passed: ok, detail: ok ? `평가금액 합계 ${fmt(mvSum, currency)}가 화면 합계와 같아요` : `평가금액 합계 ${fmt(mvSum, currency)}가 화면 합계 ${fmt(totals.marketValue, currency)}와 달라요` });
  } else if (currency === 'USD') {
    checks.push({ code: 'market_value_total', passed: false, detail: '화면 상단의 주식평가금액 합계를 읽지 못했어요' });
  }
  checks.push(cash === null
    ? { code: 'cash_present', passed: false, detail: currency === 'KRW' ? '예수금 화면이 없어요' : '외화잔고(예수금) 화면이 없어요' }
    : { code: 'cash_present', passed: true, detail: `예수금 ${fmt(cash, currency)}` });
  return checks;
}
