/**
 * Portfolio-level backtest: does any strategy beat the live alert rules for
 * the owner's actual situation (a starting balance plus a monthly
 * contribution), measured on the whole book rather than per symbol?
 *
 *   pnpm --filter api portfolio-backtest
 *
 * Why this exists next to compare-entries/compare-exits: those score a rule
 * symbol by symbol against holding that symbol, over the symbols held today.
 * That hides the cost of idle cash at the portfolio level and is biased toward
 * survivors. Here every strategy trades the same index ETFs, contributions
 * arrive monthly, trades cost money and fill on the next session, and the
 * period is split so a strategy is chosen on 2008-2018 and judged on 2019-.
 *
 * The live rules (strategy "현행 알람") are imported from services/alert-rules,
 * never restated, so this always measures what production would say.
 */
import { RULES, type SymbolSnapshot } from '../src/services/alert-rules';
import { aggregateWeekly, computeIndicatorsFromRows, type OhlcvRow } from '../src/services/technical-indicators';

const args = process.argv.slice(2);
const argOf = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const START_BALANCE = Number(argOf('start', '24810000'));
const MONTHLY = Number(argOf('monthly', '1000000'));
const COST = Number(argOf('cost', '0.0015')); // per side, on traded value
const CASH_RATE = Number(argOf('cash-rate', '0.02')); // CMA/MMF yield on idle cash

/** The owner's core: Korea + US large caps, roughly today's 38/62 split. */
const BASE: Record<string, number> = { '069500.KS': 0.4, SPY: 0.3, QQQ: 0.3 };
/** Momentum universe: broad, long-lived ETFs only, to avoid survivorship bias. */
const UNIVERSE = ['069500.KS', 'SPY', 'QQQ', 'EFA', 'EEM', 'GLD', 'IEF', 'XLE', 'XLV', 'XLP'];
const WINDOWS: Array<[string, string, string]> = [
  ['학습 2008-2018', '2008-01-01', '2018-12-31'],
  ['검증 2019-', '2019-01-01', '2099-12-31'],
  ['전체 2008-', '2008-01-01', '2099-12-31'],
];

// ─── Data ─────────────────────────────────────────────────────────────────────

const day = (ts: number) => new Date(ts * 1000 + 9 * 3600e3).toISOString().slice(0, 10);

/** Daily bars with OHLC scaled by adjclose/close, so returns include dividends
 *  and the indicators see the same total-return series. */
async function fetchBars(sym: string): Promise<OhlcvRow[]> {
  const u = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`);
  // explicit period, not range=max: Yahoo silently downgrades range=max to
  // monthly bars on long histories, which would make every "daily" rule monthly
  u.searchParams.set('interval', '1d');
  u.searchParams.set('period1', String(Date.UTC(2000, 0, 1) / 1000));
  u.searchParams.set('period2', String(Math.floor(Date.now() / 1000)));
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GokkanKeeper/1.0)' } });
  const res: any = (await r.json())?.chart?.result?.[0];
  if (!res) throw new Error(`no data for ${sym}`);
  const q = res.indicators.quote[0];
  const adj: Array<number | null> = res.indicators.adjclose?.[0]?.adjclose ?? q.close;
  const out: OhlcvRow[] = [];
  res.timestamp.forEach((ts: number, i: number) => {
    const [c, a] = [q.close[i], adj[i]];
    if (!(typeof c === 'number' && c > 0 && typeof a === 'number' && a > 0)) return;
    // early Korean ETF rows often lack open/high/low; requiring them would
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
async function fetchFx(): Promise<Map<string, number>> {
  const rows = await fetchBars('KRW=X');
  const m = new Map<string, number>();
  for (const r of rows) if (r.close > 500 && r.close < 3000) m.set(day(r.ts), r.close);
  return m;
}

/**
 * Yahoo has no usable 069500.KS rows before 2009 (closes are null), so a naive
 * forward-fill would hold Korea flat through the 2008 crash. Before the
 * primary series becomes continuous, splice in the proxy index's daily moves
 * plus an approximate dividend yield, scaled to meet the primary's first price.
 */
function splice(primary: OhlcvRow[], proxy: OhlcvRow[], dividendYield: number): OhlcvRow[] {
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

const isKrw = (sym: string) => sym.endsWith('.KS') || sym.endsWith('.KQ');

interface Asset {
  sym: string;
  bars: OhlcvRow[];
  /** KRW price on each calendar day (forward-filled), aligned to CAL */
  krw: number[];
  /** local adjusted close on each calendar day (forward-filled) */
  local: number[];
}

// ─── Engine ───────────────────────────────────────────────────────────────────

type Weights = Record<string, number>;

interface Strategy {
  name: string;
  /** Called after the close of day i. Return target weights to trade toward on
   *  day i+1, 'invest' to put idle cash to work at the current targets, or null. */
  decide(i: number, ctx: Ctx): Weights | 'invest' | null;
}

interface Ctx {
  cal: string[];
  assets: Map<string, Asset>;
  isMonthEnd: boolean;
  isFirstDay: boolean;
}

interface Result { cagr: number; mdd: number; sharpe: number; vol: number; final: number; contributed: number; costs: number; trades: number }

function run(strategy: Strategy, cal: string[], assets: Map<string, Asset>, from: number, to: number): Result {
  const units = new Map<string, number>();
  let cash = START_BALANCE, contributed = START_BALANCE, costs = 0, trades = 0;
  let pending: Weights | 'invest' | null = null;
  let lastTarget: Weights = {};
  const value = (i: number) => cash + [...units].reduce((s, [k, u]) => s + u * assets.get(k)!.krw[i], 0);

  const rets: number[] = [];
  let index = 1, peak = 1, mdd = 0, prevV = value(from);
  const dailyCash = Math.pow(1 + CASH_RATE, 1 / 365) - 1;

  for (let i = from; i <= to; i++) {
    const gapDays = i > from ? (Date.parse(cal[i]) - Date.parse(cal[i - 1])) / 86_400_000 : 0;
    cash *= Math.pow(1 + dailyCash, gapDays);
    let flow = 0;
    if (i > from && cal[i].slice(0, 7) !== cal[i - 1].slice(0, 7)) {
      cash += MONTHLY; contributed += MONTHLY; flow = MONTHLY;
      if (!pending) pending = 'invest';
    }

    if (pending) {
      const target = pending === 'invest' ? lastTarget : pending;
      if (pending !== 'invest') lastTarget = pending;
      const V = value(i);
      const totalW = Object.values(target).reduce((s, w) => s + w, 0);
      const idle = cash - (1 - totalW) * V; // cash above the strategy's own cash weight
      for (const [sym, a] of assets) {
        const px = a.krw[i];
        const cur = (units.get(sym) ?? 0) * px;
        let want = (target[sym] ?? 0) * V;
        // 'invest' only buys with idle cash, never sells: that is what monthly
        // contributions do in practice between full rebalances
        if (pending === 'invest') {
          const share = totalW > 0 ? (target[sym] ?? 0) / totalW : 0;
          want = cur + Math.max(0, idle) * share;
        }
        const diff = want - cur;
        if (Math.abs(diff) < 1000) continue;
        const fee = Math.abs(diff) * COST;
        units.set(sym, (units.get(sym) ?? 0) + diff / px);
        cash -= diff + fee; costs += fee; trades++;
      }
      pending = null;
    }

    const V = value(i);
    if (i > from) {
      const r = (V - flow) / prevV - 1;
      rets.push(r); index *= 1 + r; peak = Math.max(peak, index); mdd = Math.min(mdd, index / peak - 1);
    }
    prevV = V;

    const ctx: Ctx = {
      cal, assets,
      isMonthEnd: i === to || cal[i + 1].slice(0, 7) !== cal[i].slice(0, 7),
      isFirstDay: i === from,
    };
    const d = strategy.decide(i, ctx);
    if (d) pending = d;
  }

  const years = (Date.parse(cal[to]) - Date.parse(cal[from])) / (365.25 * 86_400_000);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
  const perYear = rets.length / years;
  return {
    cagr: Math.pow(index, 1 / years) - 1, mdd,
    sharpe: sd > 0 ? ((mean - CASH_RATE / perYear) / sd) * Math.sqrt(perYear) : 0,
    vol: sd * Math.sqrt(perYear), final: value(to), contributed, costs, trades,
  };
}

// ─── Strategies ───────────────────────────────────────────────────────────────

const lastIdx = (a: Asset, i: number, monthsBack: number, cal: string[]) => {
  // index of the last calendar day of the month `monthsBack` months before day i
  const [y, m] = cal[i].split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 - monthsBack + 1, 0)).toISOString().slice(0, 10);
  let j = i;
  while (j > 0 && cal[j] > t) j--;
  return j;
};

const buyAndHold: Strategy = {
  name: '② 적립 + 연1회 리밸런싱',
  decide(i, ctx) {
    if (ctx.isFirstDay) return { ...BASE };
    if (ctx.isMonthEnd && ctx.cal[i].slice(5, 7) === '12') return { ...BASE };
    return null;
  },
};

/** ③ Faber: hold each core sleeve only while above its 10-month average. */
function trendFilter(): Strategy {
  return {
    name: '③ 추세 필터 (10개월선)',
    decide(i, ctx) {
      if (!ctx.isMonthEnd && !ctx.isFirstDay) return null;
      const w: Weights = {};
      for (const [sym, bw] of Object.entries(BASE)) {
        const a = ctx.assets.get(sym)!;
        const closes = Array.from({ length: 10 }, (_, k) => a.local[lastIdx(a, i, k, ctx.cal)]);
        const sma = closes.reduce((s, x) => s + x, 0) / 10;
        if (a.local[i] > sma) w[sym] = bw;
      }
      return w;
    },
  };
}

/** ④ Relative + absolute momentum over the broad universe, top N monthly. */
function momentum(top: number): Strategy {
  return {
    name: `④ 상대 모멘텀 (상위 ${top})`,
    decide(i, ctx) {
      if (!ctx.isMonthEnd && !ctx.isFirstDay) return null;
      const scored = UNIVERSE.map((sym) => {
        const a = ctx.assets.get(sym)!;
        const r = (k: number) => a.krw[i] / a.krw[lastIdx(a, i, k, ctx.cal)] - 1;
        return { sym, score: (r(3) + r(6) + r(12)) / 3 };
      }).sort((x, y) => y.score - x.score);
      const w: Weights = {};
      for (const { sym, score } of scored.slice(0, top)) if (score > 0) w[sym] = 1 / top;
      return w;
    },
  };
}

/** ⑤ Core weights scaled so realized 3-month portfolio volatility targets `target`. */
function volTarget(target: number): Strategy {
  return {
    name: `⑤ 변동성 목표 ${(target * 100).toFixed(0)}%`,
    decide(i, ctx) {
      if (!ctx.isMonthEnd && !ctx.isFirstDay) return null;
      const rs: number[] = [];
      for (let j = Math.max(1, i - 63); j <= i; j++) {
        if (!Object.keys(BASE).every((sym) => Number.isFinite(ctx.assets.get(sym)!.krw[j - 1]))) continue;
        let r = 0;
        for (const [sym, bw] of Object.entries(BASE)) {
          const a = ctx.assets.get(sym)!;
          r += bw * (a.krw[j] / a.krw[j - 1] - 1);
        }
        rs.push(r);
      }
      if (rs.length < 20) return { ...BASE };
      const m = rs.reduce((s, x) => s + x, 0) / rs.length;
      const vol = Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / rs.length * 252);
      const scale = Math.min(1, target / vol);
      return Object.fromEntries(Object.entries(BASE).map(([s, w]) => [s, w * scale]));
    },
  };
}

/**
 * ① The live alerts on the core sleeves. (①b is the same rules with BUY_001
 * restoring the full sleeve, to see how much of the gap is slow re-entry.) Each sleeve has an allowed exposure
 * f in [0, 1], starting fully invested: BUY_001 adds one 25% unit, SELL_001
 * halves it — the sizes the rules' `action` text names. Weekly rules are
 * evaluated on each asset's own week end, as the Friday cron does.
 */
function liveAlerts(pre: Map<string, AlertPre>, buyStep = 0.25): Strategy {
  const buy = RULES.find((r) => r.ruleId === 'BUY_001')!;
  const sell = RULES.find((r) => r.ruleId === 'SELL_001')!;
  const f = new Map<string, number>();
  const was = new Map<string, boolean>();
  return {
    name: buyStep >= 1 ? '①b 알람, 매수 시 전량 복귀' : '① 현행 알람 (BUY_001/SELL_001)',
    decide(i, ctx) {
      if (ctx.isFirstDay) { for (const s of Object.keys(BASE)) f.set(s, 1); was.clear(); }
      let changed = ctx.isFirstDay;
      for (const sym of Object.keys(BASE)) {
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
          f.set(sym, r === buy ? Math.min(1, f.get(sym)! + buyStep) : f.get(sym)! * 0.5);
          changed = true;
        }
      }
      if (!changed) return null;
      return Object.fromEntries(Object.entries(BASE).map(([s, w]) => [s, w * f.get(s)!]));
    },
  };
}

interface AlertPre {
  weeklyByDay: Map<string, ReturnType<typeof computeIndicatorsFromRows>>;
  dailyByDay: Map<string, ReturnType<typeof computeIndicatorsFromRows>>;
}

function precomputeAlerts(a: Asset, from: string): AlertPre {
  const weeks = aggregateWeekly(a.bars);
  const weeklyByDay = new Map<string, ReturnType<typeof computeIndicatorsFromRows>>();
  weeks.forEach((w, wi) => {
    if (wi >= 41 && day(w.ts) >= from) weeklyByDay.set(day(w.ts), computeIndicatorsFromRows(weeks.slice(0, wi + 1), a.sym));
  });
  const dailyByDay = new Map<string, ReturnType<typeof computeIndicatorsFromRows>>();
  a.bars.forEach((b, bi) => {
    if (bi >= 300 && weeklyByDay.has(day(b.ts))) dailyByDay.set(day(b.ts), computeIndicatorsFromRows(a.bars.slice(Math.max(0, bi - 399), bi + 1), a.sym));
  });
  return { weeklyByDay, dailyByDay };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const syms = [...new Set([...Object.keys(BASE), ...UNIVERSE])];
const [fx, kospi, ...barsList] = await Promise.all([fetchFx(), fetchBars('^KS11'), ...syms.map(fetchBars)]);
const bySym = new Map(syms.map((s, k) => [s, barsList[k]]));
bySym.set('069500.KS', splice(bySym.get('069500.KS')!, kospi, 0.017));

// calendar: every day either the Korean or the US core trades, from 2006 on
const cal = [...new Set([...bySym.get('069500.KS')!, ...bySym.get('SPY')!].map((b) => day(b.ts)))]
  .filter((d) => d >= '2005-06-01').sort();
const fxDays = [...fx.keys()].sort();

const ffill = (pairs: Map<string, number>) => {
  const out: number[] = []; let last = NaN; const keys = [...pairs.keys()].sort(); let k = 0;
  for (const d of cal) { while (k < keys.length && keys[k] <= d) last = pairs.get(keys[k++])!; out.push(last); }
  return out;
};
const fxArr = ffill(new Map(fxDays.map((d) => [d, fx.get(d)!])));

const assets = new Map<string, Asset>();
for (const sym of syms) {
  const bars = bySym.get(sym)!;
  const local = ffill(new Map(bars.map((b) => [day(b.ts), b.close])));
  const krw = local.map((p, i) => (isKrw(sym) ? p : p * fxArr[i]));
  assets.set(sym, { sym, bars, local, krw });
}
const gaps = [...assets.values()].map((a) => {
  const ds = a.bars.map((b) => day(b.ts)); let worst = 0;
  for (let k = 1; k < ds.length; k++) worst = Math.max(worst, (Date.parse(ds[k]) - Date.parse(ds[k - 1])) / 86_400_000);
  return `${a.sym}:${a.bars.length}봉/${day(a.bars[0].ts)}/최대공백${worst}일`;
});
console.log(gaps.join('  '));
const firstValid = cal.findIndex((_, i) => [...assets.values()].every((a) => Number.isFinite(a.krw[i])));
console.log(`데이터: ${cal[firstValid]} ~ ${cal[cal.length - 1]}  (모든 자산이 존재하는 첫날부터)`);

const alertPre = new Map(Object.keys(BASE).map((s) => [s, precomputeAlerts(assets.get(s)!, '2006-01-01')]));

const makeStrategies = (): Strategy[] => [
  liveAlerts(alertPre), liveAlerts(alertPre, 1), buyAndHold, trendFilter(), momentum(3), momentum(5), volTarget(0.12), volTarget(0.15),
];

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const eok = (x: number) => `${(x / 1e8).toFixed(2)}억`;
for (const [label, fromD, toD] of WINDOWS) {
  const from = Math.max(firstValid, cal.findIndex((d) => d >= fromD));
  let toIdx = cal.length - 1;
  while (toIdx > 0 && cal[toIdx] > toD) toIdx--;
  console.log(`\n${'='.repeat(96)}\n${label}  (${cal[from]} ~ ${cal[toIdx]})  시작 ${eok(START_BALANCE)} + 월 ${(MONTHLY / 1e4).toFixed(0)}만\n${'='.repeat(96)}`);
  console.log(`${'전략'.padEnd(30)}${'CAGR'.padStart(8)}${'MDD'.padStart(9)}${'변동성'.padStart(8)}${'Sharpe'.padStart(8)}${'최종'.padStart(9)}${'납입'.padStart(9)}${'비용'.padStart(8)}${'거래'.padStart(6)}`);
  for (const s of makeStrategies()) {
    const r = run(s, cal, assets, from, toIdx);
    console.log(
      `${s.name.padEnd(30)}${pct(r.cagr).padStart(8)}${pct(r.mdd).padStart(9)}${pct(r.vol).padStart(8)}${r.sharpe.toFixed(2).padStart(8)}` +
      `${eok(r.final).padStart(9)}${eok(r.contributed).padStart(9)}${((r.costs / 1e4).toFixed(0) + '만').padStart(8)}${String(r.trades).padStart(6)}`,
    );
  }
}
console.log('\n※ CAGR/MDD/Sharpe는 납입 효과를 뺀 시간가중 수익률 기준. 원화 환산, 배당 포함(수정주가), 신호 다음 거래일 종가 체결.');
console.log(`※ 편도 비용 ${(COST * 100).toFixed(2)}%, 현금 이자 연 ${(CASH_RATE * 100).toFixed(1)}%, 세금 미반영.`);
