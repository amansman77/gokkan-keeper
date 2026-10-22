/**
 * Tests treating 주봉 MA5>MA20 as a *priority grade* on BUY_001 rather than as
 * a filter on it.
 *
 *   pnpm --filter api test-tiering -- --summary --symbols AAPL,QQQ
 *
 * The filter test (scripts/experiments/compare-candidate-entries.ts) showed the weekly golden cross
 * removes half of BUY_001's signals: drawdown improves but Sharpe falls, so as
 * a gate it costs more return than risk it removes. A grade is the middle
 * option — every signal still fires, but one below the weekly cross is sized
 * smaller instead of being dropped. Sizing is how a P2 differs from a P0 in
 * practice, so that is what is varied here.
 *
 * Also reports whether the grade predicts anything at all: the 26-week forward
 * return of P0 vs P2 signals. If the two are equal the grade carries no
 * information and no weighting scheme can help.
 *
 * Entry and exit come from services/alert-rules; nothing here is a production
 * rule change.
 */
import { RULES, type AlertRuleContext } from '../../src/services/alert-rules';
import { aggregateWeekly, computeIndicatorsFromRows, type OhlcvRow } from '../../src/services/technical-indicators';

const args = process.argv.slice(2);
const argOf = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SYMBOLS = argOf('symbols', '').split(',').map((s) => s.trim()).filter(Boolean);
const UNIT = Number(argOf('unit', '25'));
const SUMMARY = args.includes('--summary');

const live = (id: string) => { const r = RULES.find((x) => x.ruleId === id); if (!r) throw new Error(id); return r; };

/** The grade: above the rising weekly 5/20 cross is P0, below it is P2. */
const isP0 = (s: AlertRuleContext) =>
  s.weekly?.ma5 != null && s.weekly?.ma20 != null && s.weekly.ma5 > s.weekly.ma20;

/** [label, size of a P0 buy, size of a P2 buy] as multiples of one unit. */
const VARIANTS: Array<[string, number, number]> = [
  ['현행 (등급 없음, 전부 1.0)', 1, 1],
  ['P0만 매수 (P2 버림)', 1, 0],
  ['등급 P0 1.0 / P2 0.5', 1, 0.5],
  ['등급 P0 1.0 / P2 0.25', 1, 0.25],
  ['참고: 역가중 P0 0.5 / P2 1.0', 0.5, 1],
];

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

interface Row { close: number; buy: boolean; sell: boolean; p0: boolean }

/** One weekly pass, evaluating the live rules with event-transition semantics. */
function series(sym: string, daily: OhlcvRow[]): Row[] {
  const weeks = aggregateWeekly(daily);
  const buy = live('BUY_001'), sell = live('SELL_001');
  const out: Row[] = [];
  let buyWas = false, sellWas = false;
  for (let i = 41; i < weeks.length; i++) {
    const upTo = daily.filter((d) => d.ts <= weeks[i].ts);
    const snap: AlertRuleContext = {
      symbol: sym, name: sym, heldQuantity: 0,
      weekly: computeIndicatorsFromRows(weeks.slice(0, i + 1), sym),
      daily: computeIndicatorsFromRows(upTo.slice(-400), sym),
    };
    const b = buy.condition(snap);
    const s = sell.condition({ ...snap, heldQuantity: 1 });
    out.push({ close: weeks[i].close, buy: b && !buyWas, sell: s && !sellWas, p0: isP0(snap) });
    buyWas = b; sellWas = s;
  }
  return out;
}

function run(rows: Row[], sizeP0: number, sizeP2: number) {
  let cash = 100, shares = 0, buys = 0;
  const eq: number[] = [];
  for (const r of rows) {
    if (r.buy) {
      const want = UNIT * (r.p0 ? sizeP0 : sizeP2);
      const spend = Math.min(want, cash);
      if (spend > 0.01) { shares += spend / r.close; cash -= spend; buys++; }
    }
    if (r.sell && shares > 1e-9) { const s = shares * 0.5; shares -= s; cash += s * r.close; }
    eq.push(cash + shares * r.close);
  }
  const rets: number[] = [];
  for (let i = 1; i < eq.length; i++) rets.push(eq[i] / eq[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  let peak = -Infinity, mdd = 0;
  for (const v of eq) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  const years = rows.length / 52;
  return {
    cagr: (eq[eq.length - 1] / 100) ** (1 / years) - 1, mdd,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(52) : 0, buys,
  };
}

const pct = (x: number) => (x * 100).toFixed(2) + '%';
const totals = VARIANTS.map(() => ({ cagr: 0, mdd: 0, sharpe: 0, buys: 0 }));
let holdTotal = 0, n = 0;
// does the grade predict anything? 26-week forward return of each bucket
const fwdP0: number[] = [], fwdP2: number[] = [];

for (const sym of SYMBOLS) {
  const daily = await bars(sym);
  if (daily.length < 600) { console.log(`${sym}: 데이터 부족`); continue; }
  const rows = series(sym, daily);
  n++;
  holdTotal += (rows[rows.length - 1].close / rows[0].close) ** (52 / rows.length) - 1;

  rows.forEach((r, i) => {
    if (!r.buy || i + 26 >= rows.length) return;
    (r.p0 ? fwdP0 : fwdP2).push(rows[i + 26].close / r.close - 1);
  });

  const res = VARIANTS.map(([, a, b]) => run(rows, a, b));
  res.forEach((m, i) => { totals[i].cagr += m.cagr; totals[i].mdd += m.mdd; totals[i].sharpe += m.sharpe; totals[i].buys += m.buys; });

  if (SUMMARY) console.log(`${sym.padEnd(11)}` + res.map((m) => pct(m.cagr).padStart(9)).join(''));
  else {
    console.log(`\n${sym}`);
    VARIANTS.forEach(([label], i) => {
      const m = res[i];
      console.log(`  ${label.padEnd(30)}${pct(m.cagr).padStart(9)}${pct(m.mdd).padStart(10)}${m.sharpe.toFixed(2).padStart(8)}${String(m.buys).padStart(6)}`);
    });
  }
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
if (n) {
  console.log(`\n${'='.repeat(74)}`);
  console.log(`${n}종목 평균`);
  console.log(`  ${'매수 규모 배분'.padEnd(30)}${'CAGR'.padStart(9)}${'MDD'.padStart(10)}${'Sharpe'.padStart(8)}${'매수'.padStart(7)}`);
  VARIANTS.forEach(([label], i) => {
    const t = totals[i];
    console.log(`  ${label.padEnd(30)}${pct(t.cagr / n).padStart(9)}${pct(t.mdd / n).padStart(10)}${(t.sharpe / n).toFixed(2).padStart(8)}${(t.buys / n).toFixed(1).padStart(7)}`);
  });
  console.log(`  ${'단순 보유'.padEnd(30)}${pct(holdTotal / n).padStart(9)}`);

  console.log(`\n등급이 실제로 예측력이 있는가 (매수 신호 26주 후 수익률)`);
  console.log(`  P0 (주봉 MA5>MA20)  표본 ${String(fwdP0.length).padStart(4)}개   평균 ${pct(avg(fwdP0))}   승률 ${(fwdP0.filter((x) => x > 0).length / fwdP0.length * 100).toFixed(0)}%`);
  console.log(`  P2 (주봉 MA5<MA20)  표본 ${String(fwdP2.length).padStart(4)}개   평균 ${pct(avg(fwdP2))}   승률 ${(fwdP2.filter((x) => x > 0).length / fwdP2.length * 100).toFixed(0)}%`);
  console.log(`  차이                ${((avg(fwdP0) - avg(fwdP2)) * 100).toFixed(2)}%p`);
}
console.log('\n※ 진입 BUY_001, 청산 SELL_001 고정, 1단위 = ' + UNIT + '/100, 수수료·세금·배당 미반영');
console.log('※ 운영 규칙은 변경하지 않았습니다');
