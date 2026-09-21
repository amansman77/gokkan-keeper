/**
 * Compares exit rules head to head, holding BUY_001 as the entry.
 *
 *   pnpm --filter api compare-exits -- --symbols 000660.KS,QQQ
 *
 * Unlike compare-entries, this steps day by day: SELL_002 is a `daily` rule and
 * evaluating it only on week boundaries would miss most of its fires. Weekly
 * rules are evaluated on week ends, daily rules every session — matching the
 * two cron schedules in production.
 *
 * Note "SELL_001 + SELL_002" is what production actually runs today: SELL_002
 * remains enabled at P1, so simulations that only replay P0 rules understate
 * how often the live system says to sell.
 */
import { RULES, type SymbolSnapshot } from '../src/services/alert-rules';
import { aggregateWeekly, computeIndicatorsFromRows, type OhlcvRow } from '../src/services/technical-indicators';

const args = process.argv.slice(2);
const argOf = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SYMBOLS = argOf('symbols', '000660.KS').split(',').map((s) => s.trim()).filter(Boolean);
const UNIT = Number(argOf('unit', '25'));

const D = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);
const rule = (id: string) => { const r = RULES.find((x) => x.ruleId === id); if (!r) throw new Error(id); return r; };

async function bars(sym: string): Promise<OhlcvRow[]> {
  const u = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`);
  u.searchParams.set('interval', '1d'); u.searchParams.set('range', '20y');
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GokkanKeeper/1.0)' } });
  const j: any = await r.json(); const res = j?.chart?.result?.[0]; if (!res) return [];
  const ts = res.timestamp ?? []; const q = res.indicators.quote[0]; const out: OhlcvRow[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], c = q.close?.[i], h = q.high?.[i], l = q.low?.[i], v = q.volume?.[i];
    if ([o, c, h, l, v].every((x) => typeof x === 'number')) out.push({ ts: ts[i], open: o, close: c, high: h, low: l, volume: v });
  }
  return out;
}

function simulate(sym: string, daily: OhlcvRow[], exitIds: string[]) {
  const weeks = aggregateWeekly(daily);
  const weekEnd = new Set(weeks.map((w) => w.ts));
  const weekIdxByTs = new Map(weeks.map((w, i) => [w.ts, i]));
  const entry = rule('BUY_001');
  const exits = exitIds.map(rule);

  let cash = 100, shares = 0, buys = 0, sells = 0;
  const equity: number[] = [];
  const was = new Map<string, boolean>();
  let held = 0, days = 0;
  let holdShares: number | null = null;
  const entryPrices: Array<{ i: number; px: number }> = [];

  for (let i = 300; i < daily.length; i++) {
    const bar = daily[i];
    const dSnapBase = computeIndicatorsFromRows(daily.slice(Math.max(0, i - 399), i + 1), sym);
    if (holdShares === null) holdShares = 100 / bar.close;
    days++; if (shares > 1e-9) held++;

    // weekly rules only on a week end, matching the Friday cron
    if (weekEnd.has(bar.ts)) {
      const wi = weekIdxByTs.get(bar.ts)!;
      if (wi >= 41) {
        const wSnap: SymbolSnapshot = {
          symbol: sym, name: sym, positionId: sym, position: shares,
          weekly: computeIndicatorsFromRows(weeks.slice(0, wi + 1), sym), daily: dSnapBase,
        };
        for (const r of [entry, ...exits].filter((r) => r.mode === 'weekly')) {
          const met = r.condition(wSnap); const prev = was.get(r.ruleId) ?? false;
          was.set(r.ruleId, met);
          if (met && !prev) {
            if (r.type === 'BUY') {
              const spend = Math.min(UNIT, cash);
              if (spend > 0.01) { shares += spend / bar.close; cash -= spend; buys++; entryPrices.push({ i, px: bar.close }); }
            } else if (shares > 1e-9) { const s = shares * 0.5; shares -= s; cash += s * bar.close; sells++; }
          }
        }
      }
    }

    // daily rules every session, matching the weekday cron
    const dSnap: SymbolSnapshot = { symbol: sym, name: sym, positionId: sym, position: shares, weekly: null, daily: dSnapBase };
    for (const r of exits.filter((r) => r.mode === 'daily')) {
      const met = r.condition(dSnap); const prev = was.get(r.ruleId) ?? false;
      was.set(r.ruleId, met);
      if (met && !prev && shares > 1e-9) { const s = shares * 0.5; shares -= s; cash += s * bar.close; sells++; }
    }
    equity.push(cash + shares * bar.close);
  }

  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) rets.push(equity[i] / equity[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  let peak = -Infinity, mdd = 0;
  for (const v of equity) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  const years = days / 252;
  const final = equity[equity.length - 1];
  const hold = holdShares! * daily[daily.length - 1].close;

  return {
    cagr: (final / 100) ** (1 / years) - 1, mdd, sharpe: sd > 0 ? (mean / sd) * Math.sqrt(252) : 0,
    exposure: held / days, buys, sells, final, hold,
    holdCagr: (hold / 100) ** (1 / years) - 1,
  };
}

const CONFIGS: Array<[string, string[]]> = [
  ['SELL_001만 (현 P0)', ['SELL_001']],
  ['SELL_002만 (급등차익)', ['SELL_002']],
  ['SELL_001+SELL_002 (실제 운영)', ['SELL_001', 'SELL_002']],
  ['WARN_SELL_001만 (MACD)', ['WARN_SELL_001']],
];
const pct = (x: number) => (x * 100).toFixed(2) + '%';

for (const sym of SYMBOLS) {
  const daily = await bars(sym);
  if (daily.length < 700) { console.log(`\n${sym}: 데이터 부족`); continue; }
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${sym}   ${D(daily[300].ts)} ~ ${D(daily[daily.length - 1].ts)}   (진입은 BUY_001 고정)`);
  console.log('='.repeat(80));
  console.log(`${'매도규칙'.padEnd(30)}${'CAGR'.padStart(9)}${'MDD'.padStart(10)}${'Sharpe'.padStart(8)}${'노출률'.padStart(8)}${'매수'.padStart(6)}${'매도'.padStart(6)}`);
  let hold = null as null | { cagr: number };
  for (const [label, ids] of CONFIGS) {
    const m = simulate(sym, daily, ids);
    hold ??= { cagr: m.holdCagr };
    console.log(`${label.padEnd(30)}${pct(m.cagr).padStart(9)}${pct(m.mdd).padStart(10)}${m.sharpe.toFixed(2).padStart(8)}${(m.exposure * 100).toFixed(0).padStart(7)}%${String(m.buys).padStart(6)}${String(m.sells).padStart(6)}`);
  }
  if (hold) console.log(`${'Buy & Hold'.padEnd(30)}${pct(hold.cagr).padStart(9)}`);
}
console.log('\n※ 수수료·세금·배당·슬리피지 미반영, 신호 당일 종가 체결');
console.log('※ SELL_002는 daily 규칙이라 매 영업일 평가 (운영의 평일 크론과 동일)');
