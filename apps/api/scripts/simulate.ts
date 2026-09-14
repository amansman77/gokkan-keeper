/**
 * Replays the live alert rules over historical bars.
 *
 * Imports RULES from services/alert-rules and the indicator math from
 * services/technical-indicators, so what is simulated is what production
 * evaluates — a private copy of the conditions could drift and produce a
 * backtest for rules that are not the live ones.
 *
 *   pnpm --filter api simulate -- --from 2024-01-01 --unit 25
 *
 * Model, per symbol, independent and normalised to 100 units of capital:
 *   BUY_001  invests one unit (default 25) of the starting capital, if cash allows
 *   SELL_001 sells half the shares held
 * Baseline is buy-and-hold of the full 100 from the first simulated week.
 *
 * Caveats worth keeping in mind when reading the output:
 *   - no fees, slippage, taxes or dividends
 *   - fills at the weekly close of the signal bar
 *   - `position` for rule purposes is the simulated holding, not today's book
 */
import { RULES, type SymbolSnapshot } from '../src/services/alert-rules';
import {
  aggregateWeekly,
  computeIndicatorsFromRows,
  type OhlcvRow,
} from '../src/services/technical-indicators';

interface Args { from: string; unit: number; symbols: string[]; verbose: boolean }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string, d?: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : d;
  };
  return {
    from: get('from', '2024-01-01')!,
    unit: Number(get('unit', '25')),
    symbols: (get('symbols') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    verbose: a.includes('--verbose'),
  };
}

async function fetchDailyBars(symbol: string): Promise<OhlcvRow[]> {
  const url = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set('interval', '1d');
  url.searchParams.set('range', '10y');
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; GokkanKeeper/1.0)' },
  });
  if (!res.ok) return [];
  const payload: any = await res.json();
  const r = payload?.chart?.result?.[0];
  if (!r) return [];
  const ts: number[] = r.timestamp ?? [];
  const q = r.indicators?.quote?.[0] ?? {};
  const rows: OhlcvRow[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], c = q.close?.[i], h = q.high?.[i], l = q.low?.[i], v = q.volume?.[i];
    if ([o, c, h, l, v].every((x) => typeof x === 'number')) {
      rows.push({ ts: ts[i], open: o, close: c, high: h, low: l, volume: v });
    }
  }
  return rows;
}

interface Trade { date: string; rule: string; side: 'BUY' | 'SELL'; price: number; shares: number }

function simulateSymbol(symbol: string, daily: OhlcvRow[], from: string, unit: number) {
  const weeks = aggregateWeekly(daily);
  const weeklyRules = RULES.filter((r) => r.mode === 'weekly');

  const START_CAPITAL = 100;
  let cash = START_CAPITAL;
  let shares = 0;
  const trades: Trade[] = [];
  // mirrors gk_alert_rule_state: a rule fires only on a false -> true transition
  const conditionMet = new Map<string, boolean>();
  let baselineShares: number | null = null;
  // A rules strategy is out of the market until its first entry, so comparing it
  // to a hold that started on day one mostly measures time in market. Track the
  // first entry and exposure so the output can separate the two effects.
  let firstBuy: { date: string; price: number } | null = null;
  let weeksTotal = 0, weeksHolding = 0;

  for (let i = 40; i < weeks.length; i++) {
    const week = weeks[i];
    const date = new Date(week.ts * 1000).toISOString().slice(0, 10);
    if (date < from) continue;

    const weeklySlice = weeks.slice(0, i + 1);
    const dailySlice = daily.filter((d) => d.ts <= week.ts);
    if (dailySlice.length < 60) continue;

    if (baselineShares === null) baselineShares = START_CAPITAL / week.close;
    weeksTotal++;
    if (shares > 1e-9) weeksHolding++;

    const snap: SymbolSnapshot = {
      symbol,
      name: symbol,
      positionId: symbol,
      position: shares,
      weekly: computeIndicatorsFromRows(weeklySlice, symbol),
      daily: computeIndicatorsFromRows(dailySlice.slice(-400), symbol),
    };

    for (const rule of weeklyRules) {
      const met = rule.condition(snap);
      const was = conditionMet.get(rule.ruleId) ?? false;
      conditionMet.set(rule.ruleId, met);
      if (!met || was) continue;

      if (rule.type === 'BUY' && rule.priority === 'P0') {
        const spend = Math.min(unit, cash);
        if (spend > 0.01) {
          const bought = spend / week.close;
          shares += bought; cash -= spend;
          if (!firstBuy) firstBuy = { date, price: week.close };
          trades.push({ date, rule: rule.ruleId, side: 'BUY', price: week.close, shares: bought });
        }
      } else if (rule.type === 'SELL' && rule.priority === 'P0') {
        const sold = shares * 0.5;
        if (sold > 1e-9) {
          shares -= sold; cash += sold * week.close;
          trades.push({ date, rule: rule.ruleId, side: 'SELL', price: week.close, shares: sold });
        }
      }
    }
  }

  if (baselineShares === null) return null;
  const last = weeks[weeks.length - 1].close;
  const strategy = cash + shares * last;
  const hold = baselineShares * last;
  // hold measured from the strategy's own first entry — same start date, so this
  // isolates what the rules did after getting in, rather than when they got in
  const holdFromEntry = firstBuy ? START_CAPITAL * (last / firstBuy.price) : null;
  return {
    symbol, trades, strategy, hold, holdFromEntry, firstBuy,
    exposure: weeksTotal ? weeksHolding / weeksTotal : 0,
    endShares: shares, endCash: cash,
  };
}

const args = parseArgs();
const symbols = args.symbols.length ? args.symbols : (() => {
  console.error('--symbols 필요 (쉼표 구분)'); process.exit(1); return [];
})();

console.log(`기간 ${args.from} ~ 현재 · 1회 매수 단위 ${args.unit}/100 · 종목 ${symbols.length}개`);
console.log('규칙: ' + RULES.filter((r) => r.priority === 'P0').map((r) => r.ruleId).join(', ') + ' (P0만 매매)\n');

let sumStrategy = 0, sumHold = 0, counted = 0, totalTrades = 0;
let sumHoldFromEntry = 0, entryCounted = 0, sumExposure = 0;
const rows: string[] = [];

for (const sym of symbols) {
  const bars = await fetchDailyBars(sym);
  if (bars.length < 400) { rows.push(`${sym.padEnd(12)} 데이터 부족`); continue; }
  const r = simulateSymbol(sym, bars, args.from, args.unit);
  if (!r) { rows.push(`${sym.padEnd(12)} 기간 내 데이터 없음`); continue; }

  sumStrategy += r.strategy; sumHold += r.hold; counted++; totalTrades += r.trades.length;
  sumExposure += r.exposure;
  const sPct = (r.strategy / 100 - 1) * 100;
  const hPct = (r.hold / 100 - 1) * 100;
  const ePct = r.holdFromEntry != null ? (r.holdFromEntry / 100 - 1) * 100 : null;
  const vsEntry = ePct != null ? sPct - ePct : null;
  if (ePct != null) sumHoldFromEntry += r.holdFromEntry!, entryCounted++;
  rows.push(
    `${sym.padEnd(12)} 전략 ${sPct.toFixed(1).padStart(7)}%  │ 전구간보유 ${hPct.toFixed(1).padStart(7)}%  │ ` +
    `진입후보유 ${(ePct != null ? ePct.toFixed(1) : '  -').padStart(7)}%  │ ` +
    `규칙효과 ${(vsEntry != null ? (vsEntry >= 0 ? '+' : '') + vsEntry.toFixed(1) : '  -').padStart(7)}%p  │ ` +
    `투자기간 ${(r.exposure * 100).toFixed(0).padStart(3)}%  거래 ${r.trades.length}회`,
  );
  if (args.verbose) for (const t of r.trades) {
    rows.push(`    ${t.date}  ${t.side === 'BUY' ? '매수' : '매도'}  ${t.rule.padEnd(9)} @ ${t.price.toFixed(2)}`);
  }
}

console.log(rows.join('\n'));
if (counted) {
  const s = (sumStrategy / counted / 100 - 1) * 100;
  const h = (sumHold / counted / 100 - 1) * 100;
  console.log('\n' + '─'.repeat(72));
  const e = entryCounted ? (sumHoldFromEntry / entryCounted / 100 - 1) * 100 : null;
  console.log(`종목 ${counted}개 평균`);
  console.log(`  전략            ${s.toFixed(1)}%`);
  console.log(`  전구간 보유     ${h.toFixed(1)}%   ← 기간 내내 100% 투자, 전략은 평균 ${(sumExposure / counted * 100).toFixed(0)}%만 투자`);
  if (e != null) {
    console.log(`  진입후 보유     ${e.toFixed(1)}%   ← 전략의 첫 매수일부터 보유했을 경우`);
    console.log(`  규칙 효과       ${(s - e >= 0 ? '+' : '') + (s - e).toFixed(1)}%p  ← 진입 시점을 통제한 비교(이게 규칙의 실력)`);
  }
  console.log(`  총 거래         ${totalTrades}회 (종목당 ${(totalTrades / counted).toFixed(1)}회)`);
  console.log('\n※ 수수료·세금·배당·슬리피지 미반영, 신호 주의 종가 체결 가정');
  console.log('※ "전구간 보유"와의 차이는 대부분 투자 안 한 기간 탓이라 규칙 실력이 아님');
}
