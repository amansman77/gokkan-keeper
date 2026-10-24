import type {
  CashFlow, ImportCheck, ImportedHolding, ImportPositionChange, ImportProposal, ImportResult, ImportWarning, Position, Snapshot,
} from '@gokkan-keeper/shared';
import { costOf, matchPositions, suggestSymbol } from './match';
import type { MergedHolding, MergedReading } from './merge';

/**
 * Turns a checked screenshot reading into a proposal against the granary:
 * which positions change, the new snapshot, and anything the numbers cannot
 * explain. Nothing here writes; applying is a separate, owner-confirmed step.
 */

export interface ReconcileInput {
  reading: MergedReading;
  /** positions of the granary being imported */
  positions: Position[];
  /** positions of every other granary, used only to suggest symbols */
  otherPositions: Position[];
  lastSnapshot: Snapshot | null;
  flowsSinceLastSnapshot: CashFlow[];
  linkedAccountSuffix: string | null;
  date: string;
}

type Currency = 'KRW' | 'USD';
const round = (v: number, currency: Currency, costDigits = false) =>
  currency === 'KRW' ? Math.round(v) : Math.round(v * (costDigits ? 10_000 : 100)) / (costDigits ? 10_000 : 100);
const money = (v: number, currency: Currency) =>
  currency === 'KRW' ? `${Math.round(Math.abs(v)).toLocaleString('ko-KR')}원` : `$${Math.abs(v).toFixed(2)}`;

/** A dropped count is recovered from the matched position whose cost basis agrees. */
function quantityOf(h: MergedHolding, p: Position | undefined): number | null {
  if (h.quantity !== null) return h.quantity;
  if (!p?.quantity || p.avgCost == null) return null;
  return Math.abs(p.quantity * p.avgCost - costOf(h)) <= costOf(h) * 0.01 ? p.quantity : null;
}

function toImported(h: MergedHolding, quantity: number): ImportedHolding {
  return {
    name: h.name, ticker: h.ticker, quantity, marketValue: h.marketValue, profitLoss: h.profitLoss,
    profitLossPercent: h.profitLossPercent, avgCost: quantity > 0 ? costOf(h) / quantity : 0, pages: h.pages,
  };
}

interface Sorted {
  holdings: ImportedHolding[];
  changes: ImportPositionChange[];
  newHoldings: ImportProposal['newHoldings'];
  unchanged: number;
  matchedIds: Set<string>;
}

function sortRows(input: ReconcileInput, warnings: ImportWarning[]): Sorted {
  const { reading } = input;
  const matched = matchPositions(reading.holdings, input.positions, warnings);
  const out: Sorted = { holdings: [], changes: [], newHoldings: [], unchanged: 0, matchedIds: new Set([...matched.values()].map((p) => p.id)) };
  const tolerance = reading.currency === 'KRW' ? 1 : 0.01;
  for (const h of reading.holdings) {
    const p = matched.get(h);
    const quantity = quantityOf(h, p);
    if (quantity === null) continue; // reported by the 'quantities' check
    const imported = toImported(h, quantity);
    out.holdings.push(imported);
    if (!p) { out.newHoldings.push({ holding: imported, suggestion: suggestSymbol(h, input.otherPositions) }); continue; }
    const after = { quantity, avgCost: round(imported.avgCost, reading.currency, true) };
    if (p.quantity === quantity && Math.abs((p.avgCost ?? 0) - after.avgCost) <= tolerance) { out.unchanged++; continue; }
    out.changes.push({ positionId: p.id, name: p.name, holding: imported, before: { quantity: p.quantity ?? null, avgCost: p.avgCost ?? null }, after });
  }
  return out;
}

export function reconcile(input: ReconcileInput): ImportResult {
  const { reading } = input;
  const warnings = [...reading.warnings];
  const checks: ImportCheck[] = [...reading.checks, accountCheck(reading.accountSuffixes, input.linkedAccountSuffix)];
  const sorted = sortRows(input, warnings);
  const unread = reading.holdings.length - sorted.holdings.length;
  // a row without a quantity cannot be applied, and leaving it out would understate the snapshot
  checks.push(unread
    ? { code: 'quantities', passed: false, detail: `보유수량을 읽지 못한 종목이 ${unread}개 있어요. 그 종목이 보이는 화면을 다시 올려주세요` }
    : { code: 'quantities', passed: true, detail: '모든 종목의 보유수량을 읽었어요' });
  const missingPositions = input.positions
    .filter((p) => (p.quantity ?? 0) > 0 && !sorted.matchedIds.has(p.id))
    .map((p) => ({ positionId: p.id, name: p.name, quantity: p.quantity ?? 0 }));
  for (const n of sorted.newHoldings) warnings.push({ code: 'new_holding', detail: `곳간에 없는 종목이에요: ${n.holding.name}${n.suggestion ? ` → ${n.suggestion.name}(${n.suggestion.symbol})로 등록할 수 있어요` : ' (직접 등록해주세요)'}` });
  for (const m of missingPositions) warnings.push({ code: 'missing_position', detail: `곳간에는 있는데 화면에 없어요: ${m.name} ${m.quantity}주 (매도했나요?)` });

  // the broker's own total avoids rounding drift from per-row decimals
  const marketValue = round(reading.totals.marketValue ?? sorted.holdings.reduce((s, h) => s + h.marketValue, 0), reading.currency);
  const proposal: ImportProposal | null = reading.cash === null ? null : {
    changes: sorted.changes, unchanged: sorted.unchanged, newHoldings: sorted.newHoldings, missingPositions,
    snapshot: {
      date: input.date, marketValue, availableBalance: reading.cash, totalAmount: round(marketValue + reading.cash, reading.currency),
      profitLoss: round(reading.totals.profitLoss ?? sorted.holdings.reduce((s, h) => s + h.profitLoss, 0), reading.currency),
    },
  };
  const cashWarning = proposal && unexplainedCash(input, proposal);
  if (cashWarning) warnings.push(cashWarning);
  return {
    currency: reading.currency, accountSuffix: reading.accountSuffixes[0] ?? null, holdings: sorted.holdings,
    cash: reading.cash, totals: reading.totals, checks, warnings, proposal,
  };
}

function accountCheck(seen: string[], linked: string | null): ImportCheck {
  if (seen.length === 0) return { code: 'account', passed: false, detail: '계좌번호를 읽지 못했어요' };
  if (seen.length > 1) return { code: 'account', passed: false, detail: `서로 다른 계좌의 화면이 섞여 있어요 (끝자리 ${seen.join(', ')})` };
  if (linked && linked !== seen[0]) return { code: 'account', passed: false, detail: `이 곳간은 계좌 끝자리 ${linked}에 연결돼 있는데 화면은 ${seen[0]} 계좌예요` };
  return { code: 'account', passed: true, detail: linked ? `연결된 계좌(끝자리 ${linked})와 같아요` : `이 곳간을 계좌 끝자리 ${seen[0]}에 연결해요` };
}

/**
 * Cash should move only by trades and recorded deposits/withdrawals. Trade
 * cash is estimated from the change in cost basis; what remains beyond a
 * small allowance for dividends and fees is reported.
 */
function unexplainedCash(input: ReconcileInput, proposal: ImportProposal): ImportWarning | null {
  const last = input.lastSnapshot;
  const currency = input.reading.currency;
  if (!last || last.availableBalance == null) return null;
  const avgCostById = new Map(input.positions.map((p) => [p.id, p.avgCost ?? 0]));
  const costDelta = proposal.changes.reduce((s, c) => s + c.after.quantity * c.after.avgCost - (c.before.quantity ?? 0) * (c.before.avgCost ?? 0), 0)
    + proposal.newHoldings.reduce((s, n) => s + n.holding.quantity * n.holding.avgCost, 0)
    - proposal.missingPositions.reduce((s, m) => s + m.quantity * (avgCostById.get(m.positionId) ?? 0), 0);
  const flows = input.flowsSinceLastSnapshot.reduce((s, f) => s + (f.type === 'DEPOSIT' ? f.amount : -f.amount), 0);
  const gap = proposal.snapshot.availableBalance - (last.availableBalance - costDelta + flows);
  const allowance = Math.max(currency === 'KRW' ? 30_000 : 30, last.totalAmount * 0.005);
  if (Math.abs(gap) <= allowance) return null;
  const direction = gap < 0 ? ['줄었어요', '출금'] : ['늘었어요', '입금'];
  return { code: 'unexplained_cash', detail: `예수금이 매매와 기록된 입출금으로 설명되지 않게 ${money(gap, currency)} ${direction[0]}. 환전이나 ${direction[1]}이 있었나요?` };
}
