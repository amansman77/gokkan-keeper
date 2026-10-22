/**
 * Strategies replayed by backtest-engine.ts. The live rules are imported from
 * services/alert-rules, never restated, so "현행 알람" always measures what
 * production would say.
 */
import { RULES, type AlertRuleContext } from '../../src/services/alert-rules';
import { aggregateWeekly, computeIndicatorsFromRows } from '../../src/services/technical-indicators';
import { day, onlySleeves, rebalance, type Adjust, type Asset, type Strategy, type Weights } from './backtest-engine';


/** Per calendar: the month ordinal of each day and the last index of each
 *  month, so month-end lookups stay O(1) inside sweeps of thousands of runs. */
const monthIndex = new WeakMap<string[], { ord: number[]; lastOf: number[] }>();
function months(cal: string[]) {
  let mi = monthIndex.get(cal);
  if (!mi) {
    const ord: number[] = []; const lastOf: number[] = [];
    cal.forEach((d, i) => {
      if (i > 0 && d.slice(0, 7) !== cal[i - 1].slice(0, 7)) lastOf.push(i - 1);
      ord.push(lastOf.length);
    });
    lastOf.push(cal.length - 1);
    mi = { ord, lastOf };
    monthIndex.set(cal, mi);
  }
  return mi;
}

/** day i itself for monthsBack 0, else the last calendar day of the month
 *  `monthsBack` months before day i's month */
const monthEndIdx = (i: number, monthsBack: number, cal: string[]) => {
  if (monthsBack === 0) return i;
  const { ord, lastOf } = months(cal);
  return lastOf[Math.max(0, ord[i] - monthsBack)];
};

export const buyAndHold = (base: Weights): Strategy => ({
  name: '② 적립 + 연1회 리밸런싱',
  decide(i, ctx) {
    if (ctx.isFirstDay) return rebalance({ ...base });
    if (ctx.isMonthEnd && ctx.cal[i].slice(5, 7) === '12') return rebalance({ ...base });
    return null;
  },
});

/** ③ Faber: hold each sleeve only while its month-end close is above its N-month average. */
export function trendFilter(base: Weights, months = 10): Strategy {
  return {
    name: `③ 추세 필터 (${months}개월선)`,
    decide(i, ctx) {
      if (!ctx.isMonthEnd && !ctx.isFirstDay) return null;
      const w: Weights = {};
      for (const [sym, bw] of Object.entries(base)) {
        const a = ctx.assets.get(sym)!;
        const closes = Array.from({ length: months }, (_, k) => a.local[monthEndIdx(i, k, ctx.cal)]);
        if (closes.some((c) => !Number.isFinite(c))) { w[sym] = bw; continue; } // not enough history yet: hold
        const sma = closes.reduce((s, x) => s + x, 0) / months;
        w[sym] = a.local[i] > sma ? bw : 0;
      }
      return rebalance(w);
    },
  };
}

/** ④ Relative + absolute momentum over a universe, top N monthly. */
export function momentum(universe: string[], top: number): Strategy {
  return {
    name: `④ 상대 모멘텀 (상위 ${top})`,
    decide(i, ctx) {
      if (!ctx.isMonthEnd && !ctx.isFirstDay) return null;
      const scored = universe.map((sym) => {
        const a = ctx.assets.get(sym)!;
        const r = (k: number) => a.krw[i] / a.krw[monthEndIdx(i, k, ctx.cal)] - 1;
        return { sym, score: (r(3) + r(6) + r(12)) / 3 };
      }).sort((x, y) => y.score - x.score);
      const w: Weights = {};
      for (const { sym, score } of scored.slice(0, top)) if (score > 0) w[sym] = 1 / top;
      return rebalance(w);
    },
  };
}

/** ⑤ Weights scaled so realized 3-month portfolio volatility targets `target`. */
export function volTarget(base: Weights, target: number): Strategy {
  return {
    name: `⑤ 변동성 목표 ${(target * 100).toFixed(0)}%`,
    decide(i, ctx) {
      if (!ctx.isMonthEnd && !ctx.isFirstDay) return null;
      const rs: number[] = [];
      for (let j = Math.max(1, i - 63); j <= i; j++) {
        if (!Object.keys(base).every((sym) => Number.isFinite(ctx.assets.get(sym)!.krw[j - 1]))) continue;
        let r = 0;
        for (const [sym, bw] of Object.entries(base)) {
          const a = ctx.assets.get(sym)!;
          r += bw * (a.krw[j] / a.krw[j - 1] - 1);
        }
        rs.push(r);
      }
      if (rs.length < 20) return rebalance({ ...base });
      const m = rs.reduce((s, x) => s + x, 0) / rs.length;
      const vol = Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / rs.length * 252);
      const scale = Math.min(1, target / vol);
      return rebalance(Object.fromEntries(Object.entries(base).map(([s, w]) => [s, w * scale])));
    },
  };
}

export interface AlertPre {
  weeklyByDay: Map<string, ReturnType<typeof computeIndicatorsFromRows>>;
  dailyByDay: Map<string, ReturnType<typeof computeIndicatorsFromRows>>;
}

/** Indicators on the raw quote series, as production computes them. */
export function precomputeAlerts(a: Asset, from: string): AlertPre {
  const raw = a.bars.map((b) => b.raw);
  const weeks = aggregateWeekly(raw);
  const weeklyByDay = new Map<string, ReturnType<typeof computeIndicatorsFromRows>>();
  weeks.forEach((w, wi) => {
    if (wi >= 41 && day(w.ts) >= from) weeklyByDay.set(day(w.ts), computeIndicatorsFromRows(weeks.slice(Math.max(0, wi - 199), wi + 1), a.sym));
  });
  const dailyByDay = new Map<string, ReturnType<typeof computeIndicatorsFromRows>>();
  raw.forEach((b, bi) => {
    if (bi >= 300 && weeklyByDay.has(day(b.ts))) dailyByDay.set(day(b.ts), computeIndicatorsFromRows(raw.slice(Math.max(0, bi - 399), bi + 1), a.sym));
  });
  return { weeklyByDay, dailyByDay };
}

/**
 * ① The live alerts per sleeve, sized as their `action` text says: BUY_001
 * buys one unit (25% of the sleeve's base weight, never past the full sleeve)
 * and SELL_001 sells half of what is actually held. Weekly rules are evaluated
 * on each asset's own week end, as the Friday cron does, against the sleeve's
 * real holding. `buyStep: 1` is ①b (the same rules, buying the whole sleeve
 * back) to isolate slow re-entry. Contributions keep flowing to every sleeve
 * that is still held.
 */
export function liveAlerts(
  base: Weights,
  pre: Map<string, AlertPre>,
  buyStep = 0.25,
  opts: { name?: string; buyRuleId?: string; sellKeep?: number } = {},
): Strategy {
  const buy = RULES.find((r) => r.ruleId === (opts.buyRuleId ?? 'BUY_001'))!;
  const sell = RULES.find((r) => r.ruleId === 'SELL_001')!;
  const sellKeep = opts.sellKeep ?? 0.5;
  const out = new Set<string>();
  const was = new Map<string, boolean>();
  const weights = () => Object.fromEntries(Object.entries(base).map(([s, w]) => [s, out.has(s) ? 0 : w]));
  return {
    name: opts.name ?? (buyStep >= 1 ? '①b 알람, 매수 시 전량 복귀' : '① 현행 알람 (BUY_001/SELL_001)'),
    decide(i, ctx) {
      if (ctx.isFirstDay) { out.clear(); was.clear(); return rebalance(weights()); }
      const adjust: Record<string, Adjust> = {};
      for (const [sym, bw] of Object.entries(base)) {
        const p = pre.get(sym)!;
        const wk = p.weeklyByDay.get(ctx.cal[i]);
        const dl = p.dailyByDay.get(ctx.cal[i]);
        if (!wk || !dl) continue;
        const snap: AlertRuleContext = { symbol: sym, name: sym, heldQuantity: ctx.heldValue(sym) > 0 ? 1 : 0, weekly: wk, daily: dl };
        for (const r of [buy, sell]) {
          const key = `${sym}:${r.ruleId}`;
          const met = r.condition(snap);
          const fired = met && !(was.get(key) ?? false);
          was.set(key, met);
          if (!fired) continue;
          adjust[sym] = r === buy ? { add: buyStep, base: bw } : { keep: sellKeep };
          if (r === buy) out.delete(sym); else if (sellKeep === 0) out.add(sym);
        }
      }
      return Object.keys(adjust).length ? { kind: 'adjust', weights: weights(), adjust } : null;
    },
  };
}

/**
 * ①c The two MA40 rules already in RULES as a symmetric pair: SELL_001 exits
 * the whole sleeve, WARN_BUY_002 (the MA40 reclaim) buys it all back — the
 * weekly-rule version of ③, built only from conditions production has.
 */
export const maPair = (base: Weights, pre: Map<string, AlertPre>) =>
  liveAlerts(base, pre, 1, { name: '①c MA40 이탈 전량매도/회복 전량매수', buyRuleId: 'WARN_BUY_002', sellKeep: 0 });

/**
 * ③w Candidate (not in RULES): ③ evaluated on weekly bars — in while the week
 * closes above MA40, out otherwise, no slope condition. Tells whether ③'s
 * edge survives the weekly cadence production already runs on.
 */
export function weeklyMa40(base: Weights, pre: Map<string, AlertPre>): Strategy {
  const inMkt = new Map<string, boolean>();
  return {
    name: '③w 주봉 MA40 위/아래 (후보)',
    decide(i, ctx) {
      if (ctx.isFirstDay) inMkt.clear();
      const changed: string[] = [];
      for (const sym of Object.keys(base)) {
        const wk = pre.get(sym)!.weeklyByDay.get(ctx.cal[i]);
        if (!wk || wk.close == null || wk.ma40 == null) continue;
        const want = wk.close > wk.ma40;
        if (inMkt.get(sym) !== want) { inMkt.set(sym, want); changed.push(sym); }
      }
      const weights = Object.fromEntries(Object.entries(base).map(([s, w]) => [s, (inMkt.get(s) ?? true) ? w : 0]));
      if (ctx.isFirstDay) return rebalance(weights);
      return changed.length ? onlySleeves(weights, changed) : null;
    },
  };
}

export const equalWeights = (syms: string[]): Weights => Object.fromEntries(syms.map((s) => [s, 1 / syms.length]));
