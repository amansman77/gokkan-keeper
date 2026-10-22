/**
 * Data and accounting engine for the portfolio-level backtests
 * (portfolio-backtest.ts, robustness.ts in this directory); the strategies
 * live in backtest-strategies.ts. Kept free of top-level side effects so
 * several scripts can replay the same strategies over the same market data.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { OhlcvRow } from '../../src/services/technical-indicators';

/**
 * A daily bar valued on the dividend-adjusted series, carrying the raw quote
 * alongside. Valuation uses the adjusted fields so returns include dividends;
 * the live rules must see `raw`, because production's indicators are computed
 * from Yahoo's unadjusted OHLC and adjusting moves MA40/MACD crossings.
 */
export interface Bar extends OhlcvRow { raw: OhlcvRow }
export const day = (ts: number) => new Date(ts * 1000 + 9 * 3600e3).toISOString().slice(0, 10);
export const isKrw = (sym: string) => sym.endsWith('.KS') || sym.endsWith('.KQ');

// ─── Data ─────────────────────────────────────────────────────────────────────

type Num = number | null | undefined;
interface YahooChart {
  timestamp?: number[];
  indicators: { quote: Array<Record<'open' | 'high' | 'low' | 'close' | 'volume', Num[]>>; adjclose?: Array<{ adjclose: Num[] }> };
}

/** Raw Yahoo chart result, read from `cacheDir` when present so sweeps over
 *  hundreds of symbols do not refetch. */
async function loadChart(sym: string, cacheDir?: string): Promise<YahooChart> {
  const file = cacheDir ? path.join(cacheDir, `${sym.replace(/[^A-Za-z0-9.^=-]/g, '_')}.json`) : null;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) as YahooChart;
  const u = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`);
  // explicit period, not range=max: Yahoo silently downgrades range=max to
  // monthly bars on long histories, which would make every "daily" rule monthly
  u.searchParams.set('interval', '1d');
  u.searchParams.set('period1', String(Date.UTC(1998, 0, 1) / 1000));
  u.searchParams.set('period2', String(Math.floor(Date.now() / 1000)));
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GokkanKeeper/1.0)' } });
  const body = (await r.json()) as { chart?: { result?: YahooChart[] } };
  const res = body.chart?.result?.[0];
  if (!res) throw new Error(`no data for ${sym}`);
  if (file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(res)); }
  return res;
}

const positive = (x: Num): x is number => typeof x === 'number' && x > 0;

/** Daily bars: adjusted OHLC (scaled by adjclose/close) for valuation, raw
 *  quote OHLC in `raw` for the live rules' indicators. */
export async function fetchBars(sym: string, cacheDir?: string): Promise<Bar[]> {
  const res = await loadChart(sym, cacheDir);
  const q = res.indicators.quote[0];
  const adj = res.indicators.adjclose?.[0]?.adjclose ?? q.close;
  const out: Bar[] = [];
  (res.timestamp ?? []).forEach((ts, i) => {
    const c = q.close[i];
    const a = adj[i];
    if (!positive(c) || !positive(a)) return;
    // early Korean rows often lack open/high/low; requiring them would
    // silently drop years of history, so fall back to the close
    const px = (x: Num) => (positive(x) ? x : c);
    const v = q.volume[i];
    const raw: OhlcvRow = { ts, open: px(q.open[i]), high: px(q.high[i]), low: px(q.low[i]), close: c, volume: typeof v === 'number' ? v : 0 };
    const f = a / c;
    out.push({ ...raw, open: raw.open * f, high: raw.high * f, low: raw.low * f, close: a, raw });
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
  const out = new Map<string, Bar[]>();
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
export function splice(primary: Bar[], proxy: Bar[], dividendYield: number): Bar[] {
  let start = 0;
  for (let k = 1; k < primary.length; k++) if (primary[k].ts - primary[k - 1].ts > 10 * 86_400) start = k;
  const joinTs = primary[start].ts;
  const before = proxy.filter((b) => b.ts < joinTs);
  if (before.length === 0) return primary.slice(start);
  const last = before[before.length - 1];
  const scaleRow = (b: OhlcvRow, k: number): OhlcvRow => ({ ...b, open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k });
  // the raw series joins the primary's raw close and carries no dividend drift
  const rawScale = primary[start].raw.close / last.raw.close;
  let scale = primary[start].close / last.close;
  const drift = Math.pow(1 + dividendYield, 1 / 252);
  const out: Bar[] = [];
  for (let k = before.length - 1; k >= 0; k--) {
    out.unshift({ ...scaleRow(before[k], scale), raw: scaleRow(before[k].raw, rawScale) });
    scale /= drift; // earlier rows sit lower by the dividends not yet paid
  }
  return [...out, ...primary.slice(start)];
}

export interface Asset {
  sym: string;
  bars: Bar[];
  /** whether this symbol's own exchange traded on each calendar day */
  open: boolean[];
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
export function buildMarket(bySym: Map<string, Bar[]>, fx: Map<string, number> | null, from = '1998-01-01'): Market {
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
    const days = new Set(bars.map((b) => day(b.ts)));
    assets.set(sym, { sym, bars, open: cal.map((d) => days.has(d)), local, krw });
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
/**
 * A sized action on the sleeve's actual holding, as the live alerts word it:
 * `keep` sells down to that fraction of what is held ("보유 수량 50% 매도"),
 * `add` buys that fraction of the sleeve's base weight of the book, never past
 * the full sleeve and never with more than the idle cash ("1회 매수 단위").
 */
export type Adjust = { keep: number } | { add: number; base: number };
/**
 * `rebalance` moves every sleeve to its weight; `only` limits the trade to those
 * sleeves, so a signal on one stock does not quietly rebalance the others;
 * `adjust` sizes trades off current holdings. `weights` always states the
 * allocation that new monthly contributions should follow.
 */
export type Decision =
  | { kind: 'rebalance'; weights: Weights }
  | { kind: 'only'; weights: Weights; only: string[] }
  | { kind: 'adjust'; weights: Weights; adjust: Record<string, Adjust> };

export interface Ctx {
  cal: string[];
  assets: Map<string, Asset>;
  isMonthEnd: boolean;
  isFirstDay: boolean;
  /** KRW value currently held in a sleeve */
  heldValue(sym: string): number;
}

export const rebalance = (weights: Weights): Decision => ({ kind: 'rebalance', weights });
export const onlySleeves = (weights: Weights, only: string[]): Decision => ({ kind: 'only', weights, only });

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

/** The simulated account: holdings, cash, cost basis and the tax ledger. */
class Book {
  readonly units = new Map<string, number>();
  private readonly basis = new Map<string, number>();
  cash: number;
  contributed: number;
  costs = 0;
  taxes = 0;
  trades = 0;
  private realized = 0;
  lastTarget: Weights = {};

  constructor(private readonly m: Market, private readonly cfg: SimConfig) {
    this.cash = cfg.startBalance;
    this.contributed = cfg.startBalance;
  }

  value(i: number) {
    let v = this.cash;
    for (const [k, u] of this.units) v += u * this.m.assets.get(k)!.krw[i];
    return v;
  }

  contribute() { this.cash += this.cfg.monthly; this.contributed += this.cfg.monthly; }

  payTax() {
    if (!this.cfg.tax) return;
    const t = this.cfg.tax.rate * Math.max(0, this.realized - this.cfg.tax.exemption);
    this.cash -= t; this.taxes += t; this.realized = 0;
  }

  /** Moves one sleeve to `want` KRW at day i's price, booking cost and gains. */
  trade(sym: string, want: number, i: number) {
    const px = this.m.assets.get(sym)!.krw[i];
    const held = (this.units.get(sym) ?? 0) * px;
    const diff = want - held;
    if (Math.abs(diff) < 1000) return;
    const fee = Math.abs(diff) * this.cfg.cost;
    if (diff > 0) this.basis.set(sym, (this.basis.get(sym) ?? 0) + diff);
    else if (held > 0) this.bookSale(sym, -diff, held);
    this.units.set(sym, (this.units.get(sym) ?? 0) + diff / px);
    this.cash -= diff + fee; this.costs += fee; this.trades++;
  }

  private bookSale(sym: string, proceeds: number, held: number) {
    const share = proceeds / held;
    const b = this.basis.get(sym) ?? 0;
    if (!isKrw(sym)) this.realized += proceeds - b * share;
    this.basis.set(sym, b * (1 - share));
  }

  held(sym: string, i: number) { return (this.units.get(sym) ?? 0) * this.m.assets.get(sym)!.krw[i]; }

  /**
   * Executes a decision for the sleeves whose exchange is open on day i and
   * returns what is left for the rest, so a US sleeve is never filled at a
   * stale price on a US holiday — it waits for its own next session.
   */
  apply(d: Decision, i: number): Decision | null {
    const open = (sym: string) => this.m.assets.get(sym)!.open[i];
    const V = this.value(i);
    this.lastTarget = d.weights;
    if (d.kind === 'adjust') {
      const rest: Record<string, Adjust> = {};
      for (const [sym, adj] of Object.entries(d.adjust)) {
        if (open(sym)) this.trade(sym, this.adjusted(sym, adj, V, i), i); else rest[sym] = adj;
      }
      return Object.keys(rest).length ? { kind: 'adjust', weights: d.weights, adjust: rest } : null;
    }
    const syms = d.kind === 'only' ? d.only : [...new Set([...Object.keys(d.weights), ...this.units.keys()])];
    const rest = syms.filter((sym) => !open(sym));
    for (const sym of syms) if (open(sym)) this.trade(sym, (d.weights[sym] ?? 0) * V, i);
    return rest.length ? { kind: 'only', weights: d.weights, only: rest } : null;
  }

  private adjusted(sym: string, adj: Adjust, V: number, i: number) {
    const h = this.held(sym, i);
    if ('keep' in adj) return h * adj.keep;
    const full = adj.base * V;
    const room = Math.max(0, Math.min(adj.add * full, full - h, this.cash));
    return h + room;
  }

  /** Monthly contributions only buy, never sell: that is what they do in
   *  practice between full rebalances. Each sleeve's share is fixed now and
   *  filled on that sleeve's next open session. */
  queueIdle(i: number) {
    const V = this.value(i);
    const totalW = Object.values(this.lastTarget).reduce((s, w) => s + w, 0);
    const queued = [...this.queue.values()].reduce((s, x) => s + x, 0);
    // only the new contribution is invested: cash a sell signal raised stays
    // cash until a buy signal spends it, as it would in the live account
    const idle = Math.min(this.cfg.monthly, this.cash - queued - (1 - totalW) * V);
    if (idle <= 0 || totalW <= 0) return;
    for (const [sym, w] of Object.entries(this.lastTarget)) {
      if (w > 0) this.queue.set(sym, (this.queue.get(sym) ?? 0) + idle * (w / totalW));
    }
  }

  fillQueue(i: number) {
    for (const [sym, amount] of this.queue) {
      if (!this.m.assets.get(sym)!.open[i]) continue;
      this.trade(sym, this.held(sym, i) + Math.min(amount, Math.max(0, this.cash)), i);
      this.queue.delete(sym);
    }
  }

  private readonly queue = new Map<string, number>();
}

/** Time-weighted return statistics, so contributions do not count as gains. */
function summarize(rets: number[], years: number, cashRate: number) {
  let index = 1, peak = 1, mdd = 0;
  for (const r of rets) { index *= 1 + r; peak = Math.max(peak, index); mdd = Math.min(mdd, index / peak - 1); }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
  const perYear = rets.length / years;
  return {
    cagr: Math.pow(index, 1 / years) - 1, mdd,
    sharpe: sd > 0 ? ((mean - cashRate / perYear) / sd) * Math.sqrt(perYear) : 0,
    vol: sd * Math.sqrt(perYear),
  };
}

/** A new decision supersedes what is still waiting for a closed exchange,
 *  except that sized actions on different sleeves both stand. */
function merge(waiting: Decision | null, next: Decision | null): Decision | null {
  if (!next) return waiting;
  if (waiting?.kind === 'adjust' && next.kind === 'adjust') {
    return { kind: 'adjust', weights: next.weights, adjust: { ...waiting.adjust, ...next.adjust } };
  }
  return next;
}

export function run(strategy: Strategy, m: Market, from: number, to: number, cfg: SimConfig): Result {
  const { cal, assets } = m;
  const book = new Book(m, cfg);
  const dailyCash = Math.pow(1 + cfg.cashRate, 1 / 365) - 1;
  const rets: number[] = [];
  let pending: Decision | null = null;
  let prevV = book.value(from);

  for (let i = from; i <= to; i++) {
    let flow = 0;
    if (i > from) {
      book.cash *= Math.pow(1 + dailyCash, (Date.parse(cal[i]) - Date.parse(cal[i - 1])) / 86_400_000);
      if (cal[i].slice(0, 4) !== cal[i - 1].slice(0, 4)) book.payTax();
      if (cal[i].slice(0, 7) !== cal[i - 1].slice(0, 7)) { book.contribute(); flow = cfg.monthly; }
    }
    if (pending) pending = book.apply(pending, i);
    if (flow) book.queueIdle(i);
    book.fillQueue(i);
    // the last year's tax belongs in the return series, not only in `final`
    if (i === to) book.payTax();

    const V = book.value(i);
    if (i > from) rets.push((V - flow) / prevV - 1);
    prevV = V;

    const ctx: Ctx = {
      cal, assets, isFirstDay: i === from,
      isMonthEnd: i === to || cal[i + 1].slice(0, 7) !== cal[i].slice(0, 7),
      heldValue: (sym) => book.held(sym, i),
    };
    pending = merge(pending, strategy.decide(i, ctx));
  }

  const years = (Date.parse(cal[to]) - Date.parse(cal[from])) / (365.25 * 86_400_000);
  return {
    ...summarize(rets, years, cfg.cashRate),
    final: book.value(to), contributed: book.contributed, costs: book.costs, taxes: book.taxes, trades: book.trades,
  };
}
