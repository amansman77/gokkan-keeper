/**
 * Does SELL_001 miss trend breaks it should catch? The live rule fires only
 * when price crosses below MA40 *in the same week* that MA40 is falling. If
 * price breaks first while MA40 still rises (ETN, week of 2026-10-16) and MA40
 * turns down later, it never fires. The candidate fires the first week both
 * are true, in either order.
 *
 *   pnpm --filter api compare-ma40-sell -- [--samples 300] [--cache /tmp/gk-bars] [--until 2026-10-23]
 *
 * BUY_001 stays the entry for both; only the sell rule differs. The candidate
 * is defined here and is not in RULES: it ships only if it wins.
 */
import type { AlertRule } from '../../src/services/alert-rules';
import {
  buildMarket, fetchFx, fetchMany, run, splice, windowRange, type Market, type Result, type SimConfig,
} from '../simulation/backtest-engine';
import { equalWeights, liveAlerts, precomputeAlerts, type AlertPre } from '../simulation/backtest-strategies';
import { BASKETS, POOL_KR, POOL_US, STRESS } from '../simulation/pools';

const args = process.argv.slice(2);
const argOf = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SAMPLES = Number(argOf('samples', '300'));
const CACHE = argOf('cache', '') || undefined;
const UNTIL = argOf('until', '2099-12-31');

const SAT: SimConfig = { startBalance: 5_000_000, monthly: 200_000, cost: 0.0015, cashRate: 0.02, tax: { rate: 0.22, exemption: 2_500_000 } };
const CORE: SimConfig = { startBalance: 24_810_000, monthly: 1_000_000, cost: 0.0015, cashRate: 0.02 };

/** Candidate: below a falling MA40, whichever happened first. */
const SELL_TURN: AlertRule = {
  ruleId: 'CANDIDATE_SELL_MA40_TURN', type: 'SELL', priority: 'P0', title: '장기 추세 이탈 (순서 무관)', mode: 'weekly',
  condition: (snap) =>
    snap.heldQuantity > 0 &&
    snap.weekly?.close != null && snap.weekly?.ma40 != null && snap.weekly?.prevMa40 != null &&
    snap.weekly.close < snap.weekly.ma40 &&
    snap.weekly.ma40 < snap.weekly.prevMa40,
  message: () => '', action: '보유 수량 50% 매도 검토',
};

/** The owner's current holdings: survivorship-biased by construction, shown for relevance only. */
const HELD = [
  '001440.KS', '005380.KS', '007810.KS', '010170.KS', '025860.KS', '096630.KQ', '104200.KQ', '132030.KS', '133690.KS', '215600.KQ',
  '245710.KS', '278470.KS', '279530.KS', '309230.KS', '329650.KS', '419420.KS', '440110.KQ', '453810.KS', '464310.KS', '494670.KS',
  'MOAT', 'ETN', 'FIG', 'KSA', 'LMT', 'VYM', 'AAPL', 'AMZN', 'AVGO', 'GOOGL', 'NVDA', 'QQQM', 'TSLA', 'MSFT',
];

interface Pair { live: Result; turn: Result; liveSells: number; turnSells: number }

interface Case { m: Market; pre: Map<string, AlertPre>; syms: string[]; from: string; to: string; cfg: SimConfig }

function compare({ m, pre, syms, from: fromD, to: toD, cfg }: Case): Pair {
  const [from, to] = windowRange(m, syms, fromD, toD);
  const base = equalWeights(syms);
  const liveFires = { buy: 0, sell: 0 };
  const turnFires = { buy: 0, sell: 0 };
  return {
    live: run(liveAlerts(base, pre, 0.25, { fires: liveFires }), m, from, to, cfg),
    turn: run(liveAlerts(base, pre, 0.25, { sellRule: SELL_TURN, fires: turnFires }), m, from, to, cfg),
    liveSells: liveFires.sell, turnSells: turnFires.sell,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const sign = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(2)}%p`;
const quant = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const med = (xs: number[]) => quant(xs, 0.5);
const win = (xs: number[]) => `${((xs.filter((x) => x > 0).length / xs.length) * 100).toFixed(0)}%`;

function report(label: string, p: Pair) {
  console.log(`\n${label}`);
  console.log(`  ${''.padEnd(16)}${'CAGR'.padStart(8)}${'MDD'.padStart(9)}${'Sharpe'.padStart(8)}${'매도신호'.padStart(8)}`);
  console.log(`  ${'현행 SELL_001'.padEnd(16)}${pct(p.live.cagr).padStart(8)}${pct(p.live.mdd).padStart(9)}${p.live.sharpe.toFixed(2).padStart(8)}${String(p.liveSells).padStart(8)}`);
  console.log(`  ${'보완안'.padEnd(16)}${pct(p.turn.cagr).padStart(8)}${pct(p.turn.mdd).padStart(9)}${p.turn.sharpe.toFixed(2).padStart(8)}${String(p.turnSells).padStart(8)}`);
}

let seed = 20261026;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const sample = <T>(xs: T[], n: number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };

const all = [...new Set(['069500.KS', 'SPY', 'QQQ', '^KS11', ...POOL_US, ...POOL_KR, ...Object.values(BASKETS).flat(), ...STRESS.flatMap((s) => s.syms), ...HELD])];
const [fx, fetched] = await Promise.all([fetchFx(CACHE), fetchMany(all, CACHE)]);
if (fetched.missing.length) console.log(`데이터 없음(제외): ${fetched.missing.join(', ')}`);
const bars = fetched.bars;
bars.set('069500.KS', splice(bars.get('069500.KS')!, bars.get('^KS11')!, 0.017));
bars.delete('^KS11');
const have = (xs: string[]) => xs.filter((s) => bars.has(s));
const krw = buildMarket(bars, fx, '1998-01-01');
const dotcom = have(STRESS[0].syms);
const local = buildMarket(new Map(dotcom.map((s) => [s, bars.get(s)!])), null, '1998-01-01');
const preK = new Map([...krw.assets.keys()].map((s) => [s, precomputeAlerts(krw.assets.get(s)!, '1999-01-01')]));
const preL = new Map([...local.assets.keys()].map((s) => [s, precomputeAlerts(local.assets.get(s)!, '1999-01-01')]));

console.log(`${'='.repeat(80)}\nSELL_001 현행 vs 보완안 (매수는 BUY_001 고정, 위성은 세후)\n${'='.repeat(80)}`);
report('코어 지수 (2008-)', compare({ m: krw, pre: preK, syms: ['069500.KS', 'SPY', 'QQQ'], from: '2008-01-01', to: UNTIL, cfg: CORE }));
report('2010 대형주 40 (2011-)', compare({ m: krw, pre: preK, syms: have(BASKETS['2010 대형주 40']), from: '2011-01-01', to: UNTIL, cfg: SAT }));
report('2021 테마주 21 (2021-02-)', compare({ m: krw, pre: preK, syms: have(BASKETS['2021 테마주 21']), from: '2021-02-01', to: UNTIL, cfg: SAT }));
report('현재 보유 종목 (2021-06-, 생존 편향 있음)', compare({ m: krw, pre: preK, syms: have(HELD).filter((s) => krw.assets.get(s)!.bars.length > 600), from: '2021-06-01', to: UNTIL, cfg: SAT }));
for (const st of STRESS) {
  const m = st.local ? local : krw;
  const syms = have(st.syms).filter((s) => m.assets.has(s));
  report(st.label, compare({ m, pre: st.local ? preL : preK, syms, from: st.from, to: st.to, cfg: { ...SAT, tax: undefined } }));
}

const pool = have([...POOL_US, ...POOL_KR]);
console.log(`\n무작위 표본 ${SAMPLES}회 — 2010 대형주 풀 ${pool.length}종목에서 20개씩, 2011-01 ~ (세후)`);
const pairs: Pair[] = [];
for (let k = 0; k < SAMPLES; k++) pairs.push(compare({ m: krw, pre: preK, syms: sample(pool, 20), from: '2011-01-01', to: UNTIL, cfg: SAT }));
const dC = pairs.map((p) => p.turn.cagr - p.live.cagr);
const dM = pairs.map((p) => p.turn.mdd - p.live.mdd);
const dS = pairs.map((p) => p.turn.sharpe - p.live.sharpe);
console.log(`  CAGR 중앙: 현행 ${pct(med(pairs.map((p) => p.live.cagr)))} / 보완안 ${pct(med(pairs.map((p) => p.turn.cagr)))}`);
console.log(`  MDD 중앙:  현행 ${pct(med(pairs.map((p) => p.live.mdd)))} / 보완안 ${pct(med(pairs.map((p) => p.turn.mdd)))}`);
console.log(`  보완안 − 현행: CAGR 중앙 ${sign(med(dC))} [5~95%: ${sign(quant(dC, 0.05))} ~ ${sign(quant(dC, 0.95))}] 우위 ${win(dC)}`);
console.log(`                MDD  중앙 ${sign(med(dM))} [5~95%: ${sign(quant(dM, 0.05))} ~ ${sign(quant(dM, 0.95))}] 우위 ${win(dM)}`);
console.log(`                Sharpe 중앙 ${med(dS) >= 0 ? '+' : ''}${med(dS).toFixed(3)} 우위 ${win(dS)}`);
console.log(`  표본당 매도 신호 중앙: 현행 ${med(pairs.map((p) => p.liveSells))} / 보완안 ${med(pairs.map((p) => p.turnSells))}`);
console.log('\n※ 시간가중 수익률. 배당 포함, 다음 거래일 체결, 편도 0.15%, 현금 이자 2%. 위성은 해외주식 양도세 22%(연 250만 공제) 반영.');
