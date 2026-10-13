/**
 * Shared engine for the portfolio-level backtests (portfolio-backtest.ts,
 * robustness.ts). Kept free of top-level side effects so several scripts can
 * replay the same strategies over the same market data.
 *
 * The live rules are imported from services/alert-rules, never restated, so
 * "현행 알람" always measures what production would say.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RULES, type SymbolSnapshot } from '../../src/services/alert-rules';
import { aggregateWeekly, computeIndicatorsFromRows, type OhlcvRow } from '../../src/services/technical-indicators';

export type { OhlcvRow };
export const day = (ts: number) => new Date(ts * 1000 + 9 * 3600e3).toISOString().slice(0, 10);
export const isKrw = (sym: string) => sym.endsWith('.KS') || sym.endsWith('.KQ');

// ─── Data ─────────────────────────────────────────────────────────────────────

/** Daily bars with OHLC scaled by adjclose/close, so returns include dividends
 *  and the indicators see the same total-return series. `cacheDir` keeps the
 *  raw Yahoo response so sweeps over hundreds of symbols do not refetch. */
export async function fetchBars(sym: string, cacheDir?: string): Promise<OhlcvRow[]> {
  const file = cacheDir ? path.join(cacheDir, `${sym.replace(/[^A-Za-z0-9.^=-]/g, '_')}.json`) : null;
  let res: any;
  if (file && fs.existsSync(file)) {
    res = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    const u = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`);
    // explicit period, not range=max: Yahoo silently downgrades range=max to
    // monthly bars on long histories, which would make every "daily" rule monthly
    u.searchParams.set('interval', '1d');
    u.searchParams.set('period1', String(Date.UTC(1998, 0, 1) / 1000));
    u.searchParams.set('period2', String(Math.floor(Date.now() / 1000)));
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GokkanKeeper/1.0)' } });
    res = (await r.json())?.chart?.result?.[0];
    if (!res) throw new Error(`no data for ${sym}`);
    if (file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(res)); }
  }
  const q = res.indicators.quote[0];
  const adj: Array<number | null> = res.indicators.adjclose?.[0]?.adjclose ?? q.close;
  const out: OhlcvRow[] = [];
  (res.timestamp ?? []).forEach((ts: number, i: number) => {
    const [c, a] = [q.close[i], adj[i]];
    if (!(typeof c === 'number' && c > 0 && typeof a === 'number' && a > 0)) return;
    // early Korean rows often lack open/high/low; requiring them would
    // silently drop years of history, so fall back to the close
    const num = (x: unknown) => (typeof x === 'number' && x > 0 ? x : c);
    const [o, h, l, v] = [num(q.open[i]), num(q.high[i]), num(q.low[i]), q.volume[i]];
    const f = a / c;
    out.push({ ts, open: o * f, high: h * f, low: l * f, close: a, volume: typeof v === 'number' ? v : 0 });
  });
  return out;
}

/** USD/KRW by date. Yahoo's KRW=X carries a few rows quoted in the wrong unit
 *  (~0.11 instead of ~1100), so anything implausible is dropped. */
export async function fetchFx(cacheDir?: string): Promise<Map<string, number>> {
  const rows = await fetchBars('KRW=X', cacheDir);
  const m = new Map<string, number>();
  for (const r of rows) if (r.close > 500 && r.close < 3000) m.set(day(r.ts), r.close);
  return m;
}

/** Fetches many symbols a few at a time; symbols Yahoo cannot serve are
 *  reported and left out rather than failing the run. */
export async function fetchMany(syms: string[], cacheDir?: string, concurrency = 6) {
  const out = new Map<string, OhlcvRow[]>();
  const missing: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < syms.length) {
      const sym = syms[next++];
      try {
        const bars = await fetchBars(sym, cacheDir);
        if (bars.length > 300) out.set(sym, bars); else missing.push(sym);
      } catch { missing.push(sym); }
    }
  }));
  return { bars: out, missing };
}

/**
 * Yahoo has no usable 069500.KS rows before 2009 (closes are null), so a naive
 * forward-fill would hold Korea flat through the 2008 crash. Before the
 * primary series becomes continuous, splice in the proxy index's daily moves
 * plus an approximate dividend yield, scaled to meet the primary's first price.
 */
export function splice(primary: OhlcvRow[], proxy: OhlcvRow[], dividendYield: number): OhlcvRow[] {
  let start = 0;
  for (let k = 1; k < primary.length; k++) if (primary[k].ts - primary[k - 1].ts > 10 * 86_400) start = k;
  const joinTs = primary[start].ts;
  const before = proxy.filter((b) => b.ts < joinTs);
  if (before.length === 0) return primary.slice(start);
  const out: OhlcvRow[] = [];
  let scale = primary[start].close / before[before.length - 1].close;
  const drift = Math.pow(1 + dividendYield, 1 / 252);
  for (let k = before.length - 1; k >= 0; k--) {
    const b = before[k];
    out.unshift({ ...b, open: b.open * scale, high: b.high * scale, low: b.low * scale, close: b.close * scale });
    scale /= drift; // earlier rows sit lower by the dividends not yet paid
  }
  return [...out, ...primary.slice(start)];
}

export interface Asset {
  sym: string;
  bars: OhlcvRow[];
  /** valuation-currency price on each calendar day (forward-filled), aligned to cal */
  krw: number[];
  /** local adjusted close on each calendar day (forward-filled) */
  local: number[];
}

export interface Market { cal: string[]; assets: Map<string, Asset> }

/**
 * Aligns every symbol to one calendar. With `fx`, non-Korean assets are valued
 * in KRW; without it (e.g. before 2003, where KRW=X has no history) everything
 * stays in its local currency, which is only meaningful for one-currency sets.
 */
export function buildMarket(bySym: Map<string, OhlcvRow[]>, fx: Map<string, number> | null, from = '1998-01-01'): Market {
  const cal = [...new Set([...bySym.values()].flatMap((bars) => bars.map((b) => day(b.ts))))].filter((d) => d >= from).sort();
  const ffill = (pairs: Map<string, number>) => {
    const out: number[] = []; let last = NaN; const keys = [...pairs.keys()].sort(); let k = 0;
    for (const d of cal) { while (k < keys.length && keys[k] <= d) last = pairs.get(keys[k++])!; out.push(last); }
    return out;
  };
  const fxArr = fx ? ffill(fx) : null;
  const assets = new Map<string, Asset>();
  for (const [sym, bars] of bySym) {
    const local = ffill(new Map(bars.map((b) => [day(b.ts), b.close])));
    const krw = fxArr && !isKrw(sym) ? local.map((p, i) => p * fxArr[i]) : local;
    assets.set(sym, { sym, bars, local, krw });
  }
  return { cal, assets };
}

/** First calendar index at which every listed symbol has a price. */
export function firstValid(m: Market, syms: string[]): number {
  return m.cal.findIndex((_, i) => syms.every((s) => Number.isFinite(m.assets.get(s)!.krw[i])));
}

export function windowRange(m: Market, syms: string[], fromD: string, toD = '2099-12-31'): [number, number] {
  const from = Math.max(firstValid(m, syms), m.cal.findIndex((d) => d >= fromD));
  let to = m.cal.length - 1;
  while (to > 0 && m.cal[to] > toD) to--;
  return [from, to];
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export type Weights = Record<string, number>;
/** `only` limits the trade to those sleeves, so a signal on one stock does not
 *  quietly rebalance every other sleeve back to weight. */
export type Decision = Weights | { weights: Weights; only: string[] };

export interface Ctx { cal: string[]; assets: Map<string, Asset>; isMonthEnd: boolean; isFirstDay: boolean }

export interface Strategy {
  name: string;
  /** Called after the close of day i. Return target weights to trade toward on
   *  day i+1, or null to keep holdings. */
  decide(i: number, ctx: Ctx): Decision | null;
}

export interface SimConfig {
  startBalance: number;
  monthly: number;
  /** per side, on traded value */
  cost: number;
  /** CMA/MMF yield on idle cash */
  cashRate: number;
  /**
   * Korean tax on overseas-stock gains: `rate` on a calendar year's net
   * realized gain above `exemption`, paid at the year boundary. Korean listed
   * stocks are exempt for non-major holders, so only non-.KS/.KQ sleeves count.
   */
  tax?: { rate: number; exemption: number };
}

export interface Result {
  cagr: number; mdd: number; sharpe: number; vol: number;
  final: number; contributed: number; costs: number; taxes: number; trades: number;
}

export function run(strategy: Strategy, m: Market, from: number, to: number, cfg: SimConfig): Result {
  const { cal, assets } = m;
  const units = new Map<string, number>();
  const basis = new Map<string, number>();
  let cash = cfg.startBalance, contributed = cfg.startBalance, costs = 0, taxes = 0, trades = 0, realized = 0;
  let pending: Decision | null = null;
  let investNow = false;
  let lastTarget: Weights = {};
  const value = (i: number) => cash + [...units].reduce((s, [k, u]) => s + u * assets.get(k)!.krw[i], 0);

  const rets: number[] = [];
  let index = 1, peak = 1, mdd = 0, prevV = value(from);
  const dailyCash = Math.pow(1 + cfg.cashRate, 1 / 365) - 1;
  const payTax = () => {
    if (!cfg.tax) return;
    const t = cfg.tax.rate * Math.max(0, realized - cfg.tax.exemption);
    cash -= t; taxes += t; realized = 0;
  };

  for (let i = from; i <= to; i++) {
    const gapDays = i > from ? (Date.parse(cal[i]) - Date.parse(cal[i - 1])) / 86_400_000 : 0;
    cash *= Math.pow(1 + dailyCash, gapDays);
    let flow = 0;
    if (i > from && cal[i].slice(0, 4) !== cal[i - 1].slice(0, 4)) payTax();
    if (i > from && cal[i].slice(0, 7) !== cal[i - 1].slice(0, 7)) {
      cash += cfg.monthly; contributed += cfg.monthly; flow = cfg.monthly;
      investNow = true;
    }

    const trade = (sym: string, want: number) => {
      const px = assets.get(sym)!.krw[i];
      const held = (units.get(sym) ?? 0) * px;
      const diff = want - held;
      if (Math.abs(diff) < 1000) return;
      const fee = Math.abs(diff) * cfg.cost;
      if (diff > 0) basis.set(sym, (basis.get(sym) ?? 0) + diff);
      else if (held > 0) {
        const share = -diff / held;
        const b = basis.get(sym) ?? 0;
        if (!isKrw(sym)) realized += -diff - b * share;
        basis.set(sym, b * (1 - share));
      }
      units.set(sym, (units.get(sym) ?? 0) + diff / px);
      cash -= diff + fee; costs += fee; trades++;
    };

    if (pending) {
      const partial = 'only' in pending && Array.isArray(pending.only);
      const target = (partial ? (pending as { weights: Weights }).weights : pending) as Weights;
      lastTarget = target;
      const V = value(i);
      const syms = partial ? (pending as { only: string[] }).only : [...new Set([...Object.keys(target), ...units.keys()])];
      for (const sym of syms) trade(sym, (target[sym] ?? 0) * V);
      pending = null;
    }

    // monthly contributions only buy with idle cash, never sell: that is what
    // they do in practice between full rebalances
    if (investNow) {
      const V = value(i);
      const totalW = Object.values(lastTarget).reduce((s, w) => s + w, 0);
      const idle = cash - (1 - totalW) * V; // cash above the strategy's own cash weight
      if (idle > 0 && totalW > 0) {
        for (const [sym, w] of Object.entries(lastTarget)) {
          if (w > 0) trade(sym, (units.get(sym) ?? 0) * assets.get(sym)!.krw[i] + idle * (w / totalW));
        }
      }
      investNow = false;
    }

    const V = value(i);
    if (i > from) {
      const r = (V - flow) / prevV - 1;
      rets.push(r); index *= 1 + r; peak = Math.max(peak, index); mdd = Math.min(mdd, index / peak - 1);
    }
    prevV = V;

    const d = strategy.decide(i, {
      cal, assets,
      isMonthEnd: i === to || cal[i + 1].slice(0, 7) !== cal[i].slice(0, 7),
      isFirstDay: i === from,
    });
    if (d) pending = d;
  }
  payTax();

  const years = (Date.parse(cal[to]) - Date.parse(cal[from])) / (365.25 * 86_400_000);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
  const perYear = rets.length / years;
  return {
    cagr: Math.pow(index, 1 / years) - 1, mdd,
    sharpe: sd > 0 ? ((mean - cfg.cashRate / perYear) / sd) * Math.sqrt(perYear) : 0,
    vol: sd * Math.sqrt(perYear), final: value(to), contributed, costs, taxes, trades,
  };
}

// ─── Strategies ───────────────────────────────────────────────────────────────

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
    if (ctx.isFirstDay) return { ...base };
    if (ctx.isMonthEnd && ctx.cal[i].slice(5, 7) === '12') return { ...base };
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
      return w;
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
      return w;
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
      if (rs.length < 20) return { ...base };
      const m = rs.reduce((s, x) => s + x, 0) / rs.length;
      const vol = Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / rs.length * 252);
      const scale = Math.min(1, target / vol);
      return Object.fromEntries(Object.entries(base).map(([s, w]) => [s, w * scale]));
    },
  };
}

export interface AlertPre {
  weeklyByDay: Map<string, ReturnType<typeof computeIndicatorsFromRows>>;
  dailyByDay: Map<string, ReturnType<typeof computeIndicatorsFromRows>>;
}

export function precomputeAlerts(a: Asset, from: string): AlertPre {
  const weeks = aggregateWeekly(a.bars);
  const weeklyByDay = new Map<string, ReturnType<typeof computeIndicatorsFromRows>>();
  weeks.forEach((w, wi) => {
    if (wi >= 41 && day(w.ts) >= from) weeklyByDay.set(day(w.ts), computeIndicatorsFromRows(weeks.slice(Math.max(0, wi - 199), wi + 1), a.sym));
  });
  const dailyByDay = new Map<string, ReturnType<typeof computeIndicatorsFromRows>>();
  a.bars.forEach((b, bi) => {
    if (bi >= 300 && weeklyByDay.has(day(b.ts))) dailyByDay.set(day(b.ts), computeIndicatorsFromRows(a.bars.slice(Math.max(0, bi - 399), bi + 1), a.sym));
  });
  return { weeklyByDay, dailyByDay };
}

/**
 * ① The live alerts per sleeve. Each sleeve has an allowed exposure f in
 * [0, 1], starting fully invested: BUY_001 adds one 25% unit, SELL_001 halves
 * it — the sizes the rules' `action` text names. Weekly rules are evaluated on
 * each asset's own week end, as the Friday cron does. `buyStep: 1` is ①b (the
 * same rules, buying the whole sleeve back) to isolate slow re-entry.
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
  const f = new Map<string, number>();
  const was = new Map<string, boolean>();
  return {
    name: opts.name ?? (buyStep >= 1 ? '①b 알람, 매수 시 전량 복귀' : '① 현행 알람 (BUY_001/SELL_001)'),
    decide(i, ctx) {
      if (ctx.isFirstDay) { for (const s of Object.keys(base)) f.set(s, 1); was.clear(); }
      const changed: string[] = [];
      for (const sym of Object.keys(base)) {
        const p = pre.get(sym)!;
        const wk = p.weeklyByDay.get(ctx.cal[i]);
        const dl = p.dailyByDay.get(ctx.cal[i]);
        if (!wk || !dl) continue;
        const cur = f.get(sym)!;
        const snap: SymbolSnapshot = { symbol: sym, name: sym, positionId: sym, position: cur > 0 ? 1 : 0, weekly: wk, daily: dl };
        for (const r of [buy, sell]) {
          const key = `${sym}:${r.ruleId}`;
          const met = r.condition(snap);
          const fired = met && !(was.get(key) ?? false);
          was.set(key, met);
          if (!fired) continue;
          f.set(sym, r === buy ? Math.min(1, f.get(sym)! + buyStep) : f.get(sym)! * sellKeep);
          if (!changed.includes(sym)) changed.push(sym);
        }
      }
      const weights = Object.fromEntries(Object.entries(base).map(([s, w]) => [s, w * f.get(s)!]));
      if (ctx.isFirstDay) return weights;
      return changed.length ? { weights, only: changed } : null;
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
      if (ctx.isFirstDay) return weights;
      return changed.length ? { weights, only: changed } : null;
    },
  };
}

export const equalWeights = (syms: string[]): Weights => Object.fromEntries(syms.map((s) => [s, 1 / syms.length]));
