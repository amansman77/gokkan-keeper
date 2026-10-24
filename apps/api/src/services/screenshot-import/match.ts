import type { ImportSymbolSuggestion, ImportWarning, Position } from '@gokkan-keeper/shared';
import type { MergedHolding } from './merge';

/**
 * Matching OCR'd rows to stored positions. Overseas rows carry a ticker and
 * match exactly; domestic screens print names only, and OCR garbles some of
 * them ("NHN벅스" → "NHN브"), so names are compared fuzzily and confirmed by
 * quantity or by total cost basis.
 */

const normalize = (s: string) => s.toUpperCase().replace(/[\s()&.·,\-_/]/g, '');

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

export function similarity(a: string, b: string): number {
  const [x, y] = [normalize(a), normalize(b)];
  return x && y ? 1 - levenshtein(x, y) / Math.max(x.length, y.length) : 0;
}

export const costOf = (h: MergedHolding) => h.marketValue - h.profitLoss;

function score(h: MergedHolding, p: Position): number {
  const sameQuantity = h.quantity !== null && p.quantity === h.quantity ? 0.3 : 0;
  if (h.ticker) return h.ticker.toUpperCase() === p.symbol.toUpperCase() ? 2 + sameQuantity : 0;
  const cost = (p.quantity ?? 0) * (p.avgCost ?? 0);
  const sameCost = cost > 0 && Math.abs(cost - costOf(h)) / cost < 0.01 ? 0.3 : 0;
  return Math.max(similarity(h.name, p.name), similarity(h.name, p.symbol)) + sameQuantity + sameCost;
}

const MIN_SCORE = 0.75;

/** Greedy best-first assignment; each position backs at most one row. */
export function matchPositions(rows: MergedHolding[], positions: Position[], warnings: ImportWarning[]): Map<MergedHolding, Position> {
  const pairs = rows.flatMap((h) => positions.map((p) => ({ h, p, s: score(h, p) }))).filter((x) => x.s >= MIN_SCORE);
  pairs.sort((a, b) => b.s - a.s);
  const byRow = new Map<MergedHolding, Position>();
  const used = new Set<string>();
  for (const { h, p, s } of pairs) {
    if (byRow.has(h) || used.has(p.id)) continue;
    const rival = pairs.find((x) => x.h === h && x.p.id !== p.id && !used.has(x.p.id) && s - x.s < 0.05);
    if (rival) warnings.push({ code: 'ambiguous_match', detail: `"${h.name}"이(가) ${p.name}·${rival.p.name} 중 어느 종목인지 애매해서 ${p.name}로 맞췄어요` });
    byRow.set(h, p);
    used.add(p.id);
  }
  return byRow;
}

/** The best same-name position held elsewhere, to propose its symbol. */
export function suggestSymbol(h: MergedHolding, elsewhere: Position[]): ImportSymbolSuggestion | null {
  const best = elsewhere
    .map((p) => ({ p, s: h.ticker ? (h.ticker.toUpperCase() === p.symbol.toUpperCase() ? 1 : 0) : similarity(h.name, p.name) }))
    .filter((x) => x.s >= 0.75)
    .sort((a, b) => b.s - a.s)[0];
  if (best) return { symbol: best.p.symbol, name: best.p.name, market: best.p.market ?? null, assetType: best.p.assetType ?? null };
  return h.ticker ? { symbol: h.ticker, name: h.name, market: null, assetType: null } : null;
}
