/**
 * Measures the lead-lag between the WARN_BUY_002 observation (MA40 reclaim)
 * and the BUY_001 trigger (weekly MACD turn).
 *
 *   pnpm --filter api lead-lag -- --symbols 133690.KS,AAPL [--window 52]
 *
 * Reports, over the symbols given:
 *   - how many WARN_BUY_002 signals occurred
 *   - how many weeks until BUY_001 confirmed, on average
 *   - how much price moved over that wait
 *   - the share of observations BUY_001 never confirmed
 *   - CAGR/MDD of buying on the observation vs waiting for confirmation
 *
 * Rule conditions come from services/alert-rules, so this tracks the live
 * rules. Both entries are evaluated against a flat book, matching how the
 * promotion backtest was run.
 */
import { RULES, type SymbolSnapshot } from '../src/services/alert-rules';
import { aggregateWeekly, computeIndicatorsFromRows, type OhlcvRow } from '../src/services/technical-indicators';

const args = process.argv.slice(2);
const argOf = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SYMBOLS = argOf('symbols', '').split(',').map((s) => s.trim()).filter(Boolean);
const WINDOW = Number(argOf('window', '52'));
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

/** Week-indexed booleans for each rule, using event-transition semantics. */
function signals(sym: string, daily: OhlcvRow[]) {
  const weeks = aggregateWeekly(daily);
  const ids = ['WARN_BUY_002', 'BUY_001', 'SELL_001'];
  const fire: Record<string, boolean[]> = { WARN_BUY_002: [], BUY_001: [], SELL_001: [] };
  const was: Record<string, boolean> = {};
  const closes = weeks.map((w) => w.close);

  for (let i = 0; i < weeks.length; i++) {
    if (i < 41) { ids.forEach((id) => fire[id].push(false)); continue; }
    const dailyUpTo = daily.filter((d) => d.ts <= weeks[i].ts);
    const base: SymbolSnapshot = {
      symbol: sym, name: sym, positionId: sym, position: 0,
      weekly: computeIndicatorsFromRows(weeks.slice(0, i + 1), sym),
      daily: computeIndicatorsFromRows(dailyUpTo.slice(-400), sym),
    };
    for (const id of ids) {
      const r = rule(id);
      // SELL_001 needs a holding to evaluate its market condition
      const snap = r.type === 'SELL' ? { ...base, position: 1 } : base;
      const met = r.condition(snap);
      fire[id].push(met && !was[id]);
      was[id] = met;
    }
  }
  return { weeks, closes, fire };
}

/** Buy UNIT on each entry signal, halve on each SELL_001. */
function equityCurve(closes: number[], entries: boolean[], exits: boolean[]) {
  let cash = 100, shares = 0, buys = 0, sells = 0;
  const eq: number[] = [];
  for (let i = 41; i < closes.length; i++) {
    if (entries[i]) { const spend = Math.min(UNIT, cash); if (spend > 0.01) { shares += spend / closes[i]; cash -= spend; buys++; } }
    if (exits[i] && shares > 1e-9) { const s = shares * 0.5; shares -= s; cash += s * closes[i]; sells++; }
    eq.push(cash + shares * closes[i]);
  }
  const rets: number[] = [];
  for (let i = 1; i < eq.length; i++) rets.push(eq[i] / eq[i - 1] - 1);
  let peak = -Infinity, mdd = 0;
  for (const v of eq) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  const years = eq.length / 52;
  return { cagr: (eq[eq.length - 1] / 100) ** (1 / years) - 1, mdd, buys, sells };
}

const lags: number[] = [];
const moves: number[] = [];
let warnTotal = 0, neverConfirmed = 0, stillOpen = 0;
const perSymbol: string[] = [];
let sumWarnCagr = 0, sumBuyCagr = 0, sumWarnMdd = 0, sumBuyMdd = 0, counted = 0;

for (const sym of SYMBOLS) {
  const daily = await bars(sym);
  if (daily.length < 600) { perSymbol.push(`${sym.padEnd(11)} 데이터 부족`); continue; }
  const { closes, fire } = signals(sym, daily);

  let symWarn = 0, symNever = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!fire.WARN_BUY_002[i]) continue;
    warnTotal++; symWarn++;
    let found = -1;
    for (let k = i; k < Math.min(closes.length, i + WINDOW + 1); k++) if (fire.BUY_001[k]) { found = k; break; }
    if (found >= 0) {
      lags.push(found - i);
      moves.push(closes[found] / closes[i] - 1);
    } else if (i + WINDOW >= closes.length) {
      stillOpen++; // window runs past the data, cannot be called
    } else {
      neverConfirmed++; symNever++;
    }
  }

  const w = equityCurve(closes, fire.WARN_BUY_002, fire.SELL_001);
  const b = equityCurve(closes, fire.BUY_001, fire.SELL_001);
  sumWarnCagr += w.cagr; sumBuyCagr += b.cagr; sumWarnMdd += w.mdd; sumBuyMdd += b.mdd; counted++;
  perSymbol.push(
    `${sym.padEnd(11)} WARN ${String(symWarn).padStart(2)}회(미확정 ${symNever})  ` +
    `선행 ${(w.cagr * 100).toFixed(1).padStart(6)}%/${(w.mdd * 100).toFixed(0).padStart(4)}%  ` +
    `확정 ${(b.cagr * 100).toFixed(1).padStart(6)}%/${(b.mdd * 100).toFixed(0).padStart(4)}%`,
  );
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const med = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

console.log(perSymbol.join('\n'));
console.log('\n' + '='.repeat(72));
console.log(`WARN_BUY_002 → BUY_001  (확인 창 ${WINDOW}주, ${counted}종목)`);
console.log('='.repeat(72));
console.log(`  WARN 발생 총계         ${warnTotal}회`);
console.log(`  BUY_001으로 확정       ${lags.length}회 (${(lags.length / (warnTotal - stillOpen) * 100).toFixed(0)}%)`);
console.log(`  끝내 미확정            ${neverConfirmed}회 (${(neverConfirmed / (warnTotal - stillOpen) * 100).toFixed(0)}%)`);
if (stillOpen) console.log(`  판정 불가(데이터 끝)   ${stillOpen}회`);
console.log(`  확정까지 평균          ${avg(lags).toFixed(1)}주   중위 ${med(lags).toFixed(0)}주`);
console.log(`  그 사이 가격 변화      평균 ${(avg(moves) * 100).toFixed(2)}%   중위 ${(med(moves) * 100).toFixed(2)}%`);
console.log(`  기다리는 동안 상승한 비율 ${(moves.filter((m) => m > 0).length / moves.length * 100).toFixed(0)}%`);
console.log('');
console.log(`  선행매수(WARN 시점)    CAGR ${(sumWarnCagr / counted * 100).toFixed(2)}%   MDD ${(sumWarnMdd / counted * 100).toFixed(2)}%`);
console.log(`  확정매수(BUY_001)      CAGR ${(sumBuyCagr / counted * 100).toFixed(2)}%   MDD ${(sumBuyMdd / counted * 100).toFixed(2)}%`);
console.log(`  차이                   CAGR ${((sumBuyCagr - sumWarnCagr) / counted * 100).toFixed(2)}%p   MDD ${((sumBuyMdd - sumWarnMdd) / counted * 100).toFixed(2)}%p`);
console.log('\n※ 청산은 양쪽 모두 SELL_001, 1회 매수 단위 ' + UNIT + '/100, 수수료·세금 미반영');
