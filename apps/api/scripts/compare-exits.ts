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
const SUMMARY = args.includes('--summary');

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

interface Pre { daily: ReturnType<typeof computeIndicatorsFromRows>[]; weekly: Map<number, ReturnType<typeof computeIndicatorsFromRows>>; weeks: ReturnType<typeof aggregateWeekly> }

function precompute(sym: string, daily: OhlcvRow[]): Pre {
  const weeks = aggregateWeekly(daily);
  const weekIdxByTs = new Map(weeks.map((w, i) => [w.ts, i]));
  const d: Pre['daily'] = [];
  for (let i = 0; i < daily.length; i++) {
    d[i] = i < 300 ? (null as any) : computeIndicatorsFromRows(daily.slice(Math.max(0, i - 399), i + 1), sym);
  }
  const w = new Map<number, ReturnType<typeof computeIndicatorsFromRows>>();
  for (const [ts, wi] of weekIdxByTs) if (wi >= 41) w.set(ts, computeIndicatorsFromRows(weeks.slice(0, wi + 1), sym));
  return { daily: d, weekly: w, weeks };
}

function simulate(sym: string, daily: OhlcvRow[], exitIds: string[], pre: Pre) {
  const weeks = pre.weeks;
  const weekEnd = new Set(weeks.map((w) => w.ts));
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
    const dSnapBase = pre.daily[i];
    if (!dSnapBase) continue;
    if (holdShares === null) holdShares = 100 / bar.close;
    days++; if (shares > 1e-9) held++;

    // weekly rules only on a week end, matching the Friday cron
    if (weekEnd.has(bar.ts)) {
      const wk = pre.weekly.get(bar.ts);
      if (wk) {
        const wSnap: SymbolSnapshot = {
          symbol: sym, name: sym, positionId: sym, position: shares,
          weekly: wk, daily: dSnapBase,
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
    vol: sd * Math.sqrt(252),
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
  const pre = precompute(sym, daily);
  // buy & hold volatility, used to bucket the symbol
  const hc = daily.slice(300).map((b) => b.close);
  const hr: number[] = []; for (let i = 1; i < hc.length; i++) hr.push(hc[i] / hc[i - 1] - 1);
  const hm = hr.reduce((a, b) => a + b, 0) / hr.length;
  const hv = Math.sqrt(hr.reduce((a, b) => a + (b - hm) ** 2, 0) / hr.length) * Math.sqrt(252);
  const res = CONFIGS.map(([label, ids]) => ({ label, ids, m: simulate(sym, daily, ids, pre) }));
  const holdCagr = res[0].m.holdCagr;

  if (SUMMARY) {
    // one line per symbol: CAGR of each config, then hold
    const best = res.reduce((a, b) => (b.m.cagr > a.m.cagr ? b : a));
    const s002 = res.find((r) => r.ids.length === 1 && r.ids[0] === 'SELL_002')!;
    console.log(
      `${sym.padEnd(11)}${(hv * 100).toFixed(0).padStart(4)}%  ` +
      res.map((r) => pct(r.m.cagr).padStart(8)).join('') +
      `${pct(holdCagr).padStart(9)}   최선:${best.label.split(' ')[0]}` +
      `${s002.m.sells === 0 ? '  (S002 미발동)' : `  (S002 ${s002.m.sells}회)`}`,
    );
  } else {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${sym}   ${D(daily[300].ts)} ~ ${D(daily[daily.length - 1].ts)}   연변동성 ${(hv * 100).toFixed(0)}%   (진입 BUY_001 고정)`);
    console.log('='.repeat(80));
    console.log(`${'매도규칙'.padEnd(30)}${'CAGR'.padStart(9)}${'MDD'.padStart(10)}${'Sharpe'.padStart(8)}${'노출률'.padStart(8)}${'매수'.padStart(6)}${'매도'.padStart(6)}`);
    for (const r of res) console.log(`${r.label.padEnd(30)}${pct(r.m.cagr).padStart(9)}${pct(r.m.mdd).padStart(10)}${r.m.sharpe.toFixed(2).padStart(8)}${(r.m.exposure * 100).toFixed(0).padStart(7)}%${String(r.m.buys).padStart(6)}${String(r.m.sells).padStart(6)}`);
    console.log(`${'Buy & Hold'.padEnd(30)}${pct(holdCagr).padStart(9)}`);
  }
}
if (SUMMARY) console.log(`\n${'종목'.padEnd(11)}${'변동성'.padStart(5)}  ${'S001'.padStart(8)}${'S002'.padStart(8)}${'둘다'.padStart(8)}${'MACD'.padStart(8)}${'보유'.padStart(9)}`);
console.log('\n※ 수수료·세금·배당·슬리피지 미반영, 신호 당일 종가 체결');
console.log('※ SELL_002는 daily 규칙이라 매 영업일 평가 (운영의 평일 크론과 동일)');
