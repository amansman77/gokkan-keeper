/**
 * Compares entry rules head to head, holding the exit rule constant.
 *
 *   pnpm --filter api compare-entries -- --symbols 133690.KS,QQQ
 *
 * Entries compared (conditions imported from services/alert-rules, not restated):
 *   BUY_001       주봉 종가가 상승 중인 MA40 회복        (추세)
 *   WARN_BUY_001  주봉 MACD OSC 음→양 + 일봉 골든크로스   (모멘텀)
 * Exit for both: SELL_001 (하락 중인 MA40 이탈) — sells half the holding.
 *
 * NORMALISATION: WARN_BUY_001 carries `position === 0` in production. Since
 * SELL_001 only ever halves a position, that rule would fire once and never
 * again here, which measures the position filter rather than entry timing. So
 * signals are generated with position forced to 0 for both rules. Production
 * behaviour is unchanged; this only makes the comparison meaningful.
 *
 * Metrics: no fees/tax/dividends/slippage; fills at the signal week's close;
 * Sharpe uses weekly returns annualised with a 0% risk-free rate.
 */
import { RULES, type SymbolSnapshot } from '../src/services/alert-rules';
import { aggregateWeekly, computeIndicatorsFromRows, type OhlcvRow } from '../src/services/technical-indicators';

const args = process.argv.slice(2);
const argOf = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SYMBOLS = argOf('symbols', '133690.KS').split(',').map((s) => s.trim()).filter(Boolean);
const UNIT = Number(argOf('unit', '25'));
const FROM = argOf('from', '2000-01-01');

const D = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);

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

const rule = (id: string) => {
  const r = RULES.find((x) => x.ruleId === id);
  if (!r) throw new Error(`rule ${id} not found`);
  return r;
};

interface Row { date: string; close: number; buy: boolean; sell: boolean }

/** Evaluate the real rule objects once per week, so both entries see identical data. */
function signalSeries(symbol: string, daily: OhlcvRow[], entryId: string): Row[] {
  const weeks = aggregateWeekly(daily);
  const buyRule = rule(entryId);
  const sellRule = rule('SELL_001');
  const out: Row[] = [];
  let buyWas = false, sellWas = false;

  for (let i = 41; i < weeks.length; i++) {
    const w = weeks[i];
    const date = D(w.ts);
    const dailyUpTo = daily.filter((d) => d.ts <= w.ts);
    if (dailyUpTo.length < 300) continue;
    const snap: SymbolSnapshot = {
      symbol, name: symbol, positionId: symbol,
      position: 0, // normalised: compare entry timing, not the position filter
      weekly: computeIndicatorsFromRows(weeks.slice(0, i + 1), symbol),
      daily: computeIndicatorsFromRows(dailyUpTo.slice(-400), symbol),
    };
    const b = buyRule.condition(snap);
    // the sell rule needs a holding to fire; evaluate its market condition with one
    const sellSnap: SymbolSnapshot = { ...snap, position: 1 };
    const s = sellRule.condition(sellSnap);
    out.push({ date, close: w.close, buy: b && !buyWas, sell: s && !sellWas });
    buyWas = b; sellWas = s;
  }
  return out.filter((r) => r.date >= FROM);
}

function evaluate(rows: Row[]) {
  let cash = 100, shares = 0;
  let buys = 0, sells = 0, weeksHeld = 0;
  const equity: number[] = [];
  const entryIdx: number[] = [];

  rows.forEach((r, i) => {
    if (r.buy) {
      const spend = Math.min(UNIT, cash);
      if (spend > 0.01) { shares += spend / r.close; cash -= spend; buys++; entryIdx.push(i); }
    }
    if (r.sell && shares > 1e-9) { const sold = shares * 0.5; shares -= sold; cash += sold * r.close; sells++; }
    if (shares > 1e-9) weeksHeld++;
    equity.push(cash + shares * r.close);
  });

  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) rets.push(equity[i] / equity[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(52) : 0;

  let peak = -Infinity, mdd = 0;
  for (const v of equity) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }

  const years = rows.length / 52;
  const final = equity[equity.length - 1];

  // entry lag: weeks between the trough of the prior 52 weeks and the entry
  const lags = entryIdx.map((i) => {
    const lo = Math.max(0, i - 52);
    let minI = lo;
    for (let k = lo; k <= i; k++) if (rows[k].close < rows[minI].close) minI = k;
    return i - minI;
  });
  const avgLag = lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : null;

  // win rate: share of entries with a higher price 26 weeks on
  const fwd = entryIdx.map((i) => (i + 26 < rows.length ? rows[i + 26].close / rows[i].close - 1 : null))
    .filter((x): x is number => x != null);
  const win = fwd.length ? fwd.filter((x) => x > 0).length / fwd.length * 100 : null;

  return {
    final, cagr: (final / 100) ** (1 / years) - 1, mdd, sharpe,
    exposure: rows.length ? weeksHeld / rows.length : 0,
    buys, sells, trades: buys + sells, avgLag, win, nFwd: fwd.length,
  };
}

function holdStats(rows: Row[]) {
  const sh = 100 / rows[0].close;
  const eq = rows.map((r) => sh * r.close);
  const rets: number[] = [];
  for (let i = 1; i < eq.length; i++) rets.push(eq[i] / eq[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  let peak = -Infinity, mdd = 0;
  for (const v of eq) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  const years = rows.length / 52;
  return { final: eq[eq.length - 1], cagr: (eq[eq.length - 1] / 100) ** (1 / years) - 1, mdd, sharpe: sd > 0 ? (mean / sd) * Math.sqrt(52) : 0 };
}

const pct = (x: number) => (x * 100).toFixed(2) + '%';

for (const sym of SYMBOLS) {
  const daily = await bars(sym);
  if (daily.length < 500) { console.log(`\n${sym}: 데이터 부족`); continue; }

  const series: Record<string, Row[]> = {
    BUY_001: signalSeries(sym, daily, 'BUY_001'),
    WARN_BUY_001: signalSeries(sym, daily, 'WARN_BUY_001'),
  };
  const first = series.BUY_001;
  console.log(`\n${'='.repeat(78)}`);
  console.log(`${sym}   ${first[0].date} ~ ${first[first.length - 1].date}   (${(first.length / 52).toFixed(1)}년, 1회 매수 ${UNIT}/100)`);
  console.log('='.repeat(78));
  console.log(`${'진입규칙'.padEnd(16)}${'CAGR'.padStart(8)}${'MDD'.padStart(9)}${'Sharpe'.padStart(8)}${'승률'.padStart(8)}${'진입지연'.padStart(10)}${'노출률'.padStart(8)}${'거래'.padStart(7)}`);

  for (const [id, rows] of Object.entries(series)) {
    const m = evaluate(rows);
    console.log(
      `${id.padEnd(16)}${pct(m.cagr).padStart(8)}${pct(m.mdd).padStart(9)}${m.sharpe.toFixed(2).padStart(8)}` +
      `${(m.win != null ? m.win.toFixed(0) + '%' : '-').padStart(8)}${(m.avgLag != null ? m.avgLag.toFixed(1) + '주' : '-').padStart(10)}` +
      `${(m.exposure * 100).toFixed(0).padStart(7)}%${String(m.trades).padStart(7)}`,
    );
  }
  const h = holdStats(first);
  console.log(`${'Buy & Hold'.padEnd(16)}${pct(h.cagr).padStart(8)}${pct(h.mdd).padStart(9)}${h.sharpe.toFixed(2).padStart(8)}${'-'.padStart(8)}${'-'.padStart(10)}${'100%'.padStart(8)}${'0'.padStart(7)}`);

  for (const [id, rows] of Object.entries(series)) {
    const m = evaluate(rows);
    console.log(`  ${id}: 매수 ${m.buys}회 / 매도 ${m.sells}회, 승률 표본 ${m.nFwd}개`);
  }
}

console.log('\n※ 승률 = 매수 신호 26주 후 가격이 높았던 비율');
console.log('※ 진입지연 = 직전 52주 최저점 이후 몇 주 만에 매수했는지 (낮을수록 바닥 근처)');
console.log('※ Sharpe = 주간수익률 연환산, 무위험수익률 0% 가정');
console.log('※ 수수료·세금·배당·슬리피지 미반영');
