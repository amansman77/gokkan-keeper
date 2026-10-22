/**
 * Portfolio-level backtest: does any strategy beat the live alert rules for
 * the owner's actual situation (a starting balance plus a monthly
 * contribution), measured on the whole book rather than per symbol?
 *
 *   pnpm --filter api portfolio-backtest
 *   pnpm --filter api portfolio-backtest -- --sleeves A,B,C --start 5000000 --monthly 200000 \
 *     --windows "label:2011-01-01:2018-12-31;label2:2019-01-01:"
 *
 * Why this exists next to compare-entries/compare-exits: those score a rule
 * symbol by symbol against holding that symbol, over the symbols held today.
 * That hides the cost of idle cash at the portfolio level and is biased toward
 * survivors. Here every strategy trades the same instruments, contributions
 * arrive monthly, trades cost money and fill on the next session, and the
 * period is split so a strategy is chosen on 2008-2018 and judged on 2019-.
 * The engine lives in backtest-engine.ts; robustness.ts reuses it for sweeps.
 */
import {
  buildMarket, fetchBars, fetchFx, run, splice, windowRange, type SimConfig, type Strategy,
} from './backtest-engine';
import {
  buyAndHold, equalWeights, liveAlerts, maPair, momentum, precomputeAlerts, trendFilter, volTarget, weeklyMa40,
} from './backtest-strategies';

const args = process.argv.slice(2);
const argOf = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const cfg: SimConfig = {
  startBalance: Number(argOf('start', '24810000')),
  monthly: Number(argOf('monthly', '1000000')),
  cost: Number(argOf('cost', '0.0015')),
  cashRate: Number(argOf('cash-rate', '0.02')),
  tax: args.includes('--tax') ? { rate: 0.22, exemption: 2_500_000 } : undefined,
};

/**
 * `--sleeves A,B,C` replaces the core with equal-weight sleeves (e.g. a basket
 * of individual stocks picked by an ex-ante rule) and runs only the strategies
 * that apply per sleeve; `--windows "label:from:to;..."` replaces the periods.
 */
const SLEEVES = argOf('sleeves', '').split(',').map((x) => x.trim()).filter(Boolean);
/** The owner's core: Korea + US large caps, roughly today's 38/62 split. */
const BASE = SLEEVES.length ? equalWeights(SLEEVES) : { '069500.KS': 0.4, SPY: 0.3, QQQ: 0.3 };
/** Momentum universe: broad, long-lived ETFs only, to avoid survivorship bias. */
const UNIVERSE = SLEEVES.length ? [] : ['069500.KS', 'SPY', 'QQQ', 'EFA', 'EEM', 'GLD', 'IEF', 'XLE', 'XLV', 'XLP'];
const WINDOWS: Array<[string, string, string]> = argOf('windows', '')
  ? argOf('windows', '').split(';').map((w) => { const [l, f, t] = w.split(':'); return [l, f, t || '2099-12-31'] as [string, string, string]; })
  : [
      ['학습 2008-2018', '2008-01-01', '2018-12-31'],
      ['검증 2019-', '2019-01-01', '2099-12-31'],
      ['전체 2008-', '2008-01-01', '2099-12-31'],
    ];

const syms = [...new Set([...Object.keys(BASE), ...UNIVERSE])];
const [fx, kospi, ...barsList] = await Promise.all([fetchFx(), fetchBars('^KS11'), ...syms.map((s) => fetchBars(s))]);
const bySym = new Map(syms.map((s, k) => [s, barsList[k]]));
if (bySym.has('069500.KS')) bySym.set('069500.KS', splice(bySym.get('069500.KS')!, kospi, 0.017));
const market = buildMarket(bySym, fx, '2005-06-01');
const pre = new Map(Object.keys(BASE).map((s) => [s, precomputeAlerts(market.assets.get(s)!, '2006-01-01')]));

const makeStrategies = (): Strategy[] => [
  liveAlerts(BASE, pre), liveAlerts(BASE, pre, 1), maPair(BASE, pre), buyAndHold(BASE), trendFilter(BASE), weeklyMa40(BASE, pre),
  ...(UNIVERSE.length ? [momentum(UNIVERSE, 3), momentum(UNIVERSE, 5), volTarget(BASE, 0.12), volTarget(BASE, 0.15)] : []),
];

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const eok = (x: number) => `${(x / 1e8).toFixed(2)}억`;
for (const [label, fromD, toD] of WINDOWS) {
  const [from, to] = windowRange(market, syms, fromD, toD);
  console.log(`\n${'='.repeat(104)}\n${label}  (${market.cal[from]} ~ ${market.cal[to]})  시작 ${eok(cfg.startBalance)} + 월 ${(cfg.monthly / 1e4).toFixed(0)}만\n${'='.repeat(104)}`);
  console.log(`${'전략'.padEnd(30)}${'CAGR'.padStart(8)}${'MDD'.padStart(9)}${'변동성'.padStart(8)}${'Sharpe'.padStart(8)}${'최종'.padStart(9)}${'납입'.padStart(9)}${'비용'.padStart(8)}${'세금'.padStart(8)}${'거래'.padStart(6)}`);
  for (const s of makeStrategies()) {
    const r = run(s, market, from, to, cfg);
    console.log(
      `${s.name.padEnd(30)}${pct(r.cagr).padStart(8)}${pct(r.mdd).padStart(9)}${pct(r.vol).padStart(8)}${r.sharpe.toFixed(2).padStart(8)}` +
      `${eok(r.final).padStart(9)}${eok(r.contributed).padStart(9)}${((r.costs / 1e4).toFixed(0) + '만').padStart(8)}${((r.taxes / 1e4).toFixed(0) + '만').padStart(8)}${String(r.trades).padStart(6)}`,
    );
  }
}
console.log('\n※ CAGR/MDD/Sharpe는 납입 효과를 뺀 시간가중 수익률 기준. 원화 환산, 배당 포함(수정주가), 신호 다음 거래일 종가 체결.');
console.log(`※ 편도 비용 ${(cfg.cost * 100).toFixed(2)}%, 현금 이자 연 ${(cfg.cashRate * 100).toFixed(1)}%, ${cfg.tax ? '해외주식 양도세 22%(연 250만 공제) 반영' : '세금 미반영 (--tax로 반영)'}.`);
