/**
 * Backtests candidate entry rules against the live BUY_001 before any of them
 * are put into production.
 *
 *   pnpm --filter api test-candidate -- --symbols AAPL,QQQ [--summary]
 *
 * The live rule is imported from services/alert-rules; candidates are defined
 * here on purpose, so an untested idea never sits in the production rule list.
 * Promote one only after it wins, by moving its condition into alert-rules.
 *
 * Exit is SELL_001 for every variant, so only the entry differs.
 */
import { RULES, type AlertRuleContext } from '../src/services/alert-rules';
import { aggregateWeekly, computeIndicatorsFromRows, type OhlcvRow } from '../src/services/technical-indicators';

const args = process.argv.slice(2);
const argOf = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SYMBOLS = argOf('symbols', '').split(',').map((s) => s.trim()).filter(Boolean);
const UNIT = Number(argOf('unit', '25'));
const SUMMARY = args.includes('--summary');

const live = (id: string) => { const r = RULES.find((x) => x.ruleId === id); if (!r) throw new Error(id); return r; };

/** Candidate conditions. `weekly` indicators are computed from weekly bars, so
 *  weekly.ma5 / weekly.ma20 are the 5- and 20-week averages. */
const CANDIDATES: Array<[string, (s: AlertRuleContext) => boolean]> = [
  ['현행 BUY_001 (전환+일봉GC+RSI)', (s) => live('BUY_001').condition(s)],
  // zero crossing instead of "rising", with the weekly golden cross added
  ['전환+일봉GC+주봉GC', (s) => cross(s) && dailyGC(s) && weeklyGC(s)],
  ['전환+일봉GC+주봉GC+RSI<80', (s) => cross(s) && dailyGC(s) && weeklyGC(s) && rsiOk(s)],
  // isolate each filter's contribution
  ['전환+주봉GC (일봉GC 제외)', (s) => cross(s) && weeklyGC(s)],
  ['전환만 (필터 없음)', (s) => cross(s)],
];

/** weekly MACD OSC crossing up through zero */
const cross = (s: AlertRuleContext) =>
  s.weekly?.prevMacdOsc != null && s.weekly?.macdOsc != null &&
  s.weekly.prevMacdOsc <= 0 && s.weekly.macdOsc > 0;
const dailyGC = (s: AlertRuleContext) =>
  s.daily?.ma5 != null && s.daily?.ma20 != null && s.daily.ma5 > s.daily.ma20;
/** weekly indicators come from weekly bars, so ma5/ma20 are 5- and 20-week */
const weeklyGC = (s: AlertRuleContext) =>
  s.weekly?.ma5 != null && s.weekly?.ma20 != null && s.weekly.ma5 > s.weekly.ma20;
const rsiOk = (s: AlertRuleContext) => s.daily?.rsi != null && s.daily.rsi < 80;

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

function snapshots(sym: string, daily: OhlcvRow[]) {
  const weeks = aggregateWeekly(daily);
  const out: Array<{ close: number; snap: AlertRuleContext }> = [];
  for (let i = 0; i < weeks.length; i++) {
    if (i < 41) { out.push(null as any); continue; }
    const upTo = daily.filter((d) => d.ts <= weeks[i].ts);
    out.push({
      close: weeks[i].close,
      snap: {
        symbol: sym, name: sym, heldQuantity: 0,
        weekly: computeIndicatorsFromRows(weeks.slice(0, i + 1), sym),
        daily: computeIndicatorsFromRows(upTo.slice(-400), sym),
      },
    });
  }
  return out;
}

function run(rows: ReturnType<typeof snapshots>, entry: (s: AlertRuleContext) => boolean) {
  const sell = live('SELL_001');
  let cash = 100, shares = 0, buys = 0, sells = 0, held = 0, n = 0;
  let wasBuy = false, wasSell = false;
  const eq: number[] = [];
  for (const row of rows) {
    if (!row) continue;
    n++; if (shares > 1e-9) held++;
    const b = entry(row.snap);
    const s = sell.condition({ ...row.snap, heldQuantity: 1 });
    if (b && !wasBuy) { const spend = Math.min(UNIT, cash); if (spend > 0.01) { shares += spend / row.close; cash -= spend; buys++; } }
    if (s && !wasSell && shares > 1e-9) { const q = shares * 0.5; shares -= q; cash += q * row.close; sells++; }
    wasBuy = b; wasSell = s;
    eq.push(cash + shares * row.close);
  }
  const rets: number[] = [];
  for (let i = 1; i < eq.length; i++) rets.push(eq[i] / eq[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  let peak = -Infinity, mdd = 0;
  for (const v of eq) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  const years = n / 52;
  return {
    cagr: (eq[eq.length - 1] / 100) ** (1 / years) - 1, mdd,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(52) : 0,
    buys, sells, exposure: held / n,
  };
}

const pct = (x: number) => (x * 100).toFixed(2) + '%';
const totals = CANDIDATES.map(() => ({ cagr: 0, mdd: 0, sharpe: 0, buys: 0, n: 0 }));
let holdTotal = 0;

for (const sym of SYMBOLS) {
  const daily = await bars(sym);
  if (daily.length < 600) { console.log(`${sym}: 데이터 부족`); continue; }
  const rows = snapshots(sym, daily);
  const valid = rows.filter(Boolean);
  const holdCagr = (valid[valid.length - 1].close / valid[0].close) ** (52 / valid.length) - 1;
  holdTotal += holdCagr;

  const res = CANDIDATES.map(([, f]) => run(rows, f));
  res.forEach((m, i) => { totals[i].cagr += m.cagr; totals[i].mdd += m.mdd; totals[i].sharpe += m.sharpe; totals[i].buys += m.buys; totals[i].n++; });

  if (SUMMARY) {
    console.log(`${sym.padEnd(11)}` + res.map((m) => pct(m.cagr).padStart(9)).join('') + pct(holdCagr).padStart(10));
  } else {
    console.log(`\n${sym}  (보유 ${pct(holdCagr)})`);
    console.log(`  ${'진입 조건'.padEnd(28)}${'CAGR'.padStart(9)}${'MDD'.padStart(10)}${'Sharpe'.padStart(8)}${'매수'.padStart(6)}${'노출'.padStart(7)}`);
    CANDIDATES.forEach(([label], i) => {
      const m = res[i];
      console.log(`  ${label.padEnd(28)}${pct(m.cagr).padStart(9)}${pct(m.mdd).padStart(10)}${m.sharpe.toFixed(2).padStart(8)}${String(m.buys).padStart(6)}${(m.exposure * 100).toFixed(0).padStart(6)}%`);
    });
  }
}

const n = totals[0].n;
if (n) {
  console.log(`\n${'='.repeat(74)}`);
  console.log(`${n}종목 평균`);
  console.log(`  ${'진입 조건'.padEnd(28)}${'CAGR'.padStart(9)}${'MDD'.padStart(10)}${'Sharpe'.padStart(8)}${'매수/종목'.padStart(10)}`);
  CANDIDATES.forEach(([label], i) => {
    const t = totals[i];
    console.log(`  ${label.padEnd(28)}${pct(t.cagr / n).padStart(9)}${pct(t.mdd / n).padStart(10)}${(t.sharpe / n).toFixed(2).padStart(8)}${(t.buys / n).toFixed(1).padStart(10)}`);
  });
  console.log(`  ${'단순 보유'.padEnd(28)}${pct(holdTotal / n).padStart(9)}`);
}
console.log('\n※ 청산은 전부 SELL_001, 수수료·세금·배당 미반영');
console.log('※ 후보 조건은 이 스크립트 안에만 있고 운영 규칙에는 들어가지 않았습니다');
