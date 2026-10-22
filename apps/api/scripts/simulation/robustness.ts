/**
 * Robustness checks for the finding that a monthly 10-month-SMA filter beats
 * the live alerts on satellite stocks. Four questions, each able to sink it:
 *
 *   1. Window: does it hold for 6-14 months, or only at 10?
 *   2. Sampling: across hundreds of random 20-stock baskets drawn from a pool
 *      picked ex ante (2010's large caps), how often does it win, by how much?
 *   3. Regimes: the 2000 dot-com bust, the 2011 Korean "차화정" unwind and the
 *      2015 Korean biotech collapse, none of which the earlier test covered.
 *   4. Tax: overseas-stock gains are taxed at 22% above 2.5M KRW a year, and
 *      a filter that exits fully realizes gains far more often than holding.
 *
 *   pnpm --filter api robustness -- [--samples 300] [--cache /tmp/gk-bars]
 *
 * Survivorship is reduced, not removed: names delisted or merged since their
 * pick date have no Yahoo history and drop out of every pool here.
 */
import {
  buildMarket, buyAndHold, equalWeights, fetchFx, fetchMany, liveAlerts, precomputeAlerts, run,
  splice, trendFilter, windowRange, type AlertPre, type Result, type SimConfig, type Strategy, type Weights,
} from './backtest-engine';

const args = process.argv.slice(2);
const argOf = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SAMPLES = Number(argOf('samples', '300'));
const CACHE = argOf('cache', '') || undefined;

/** Satellite scale from the owner's plan: 5M KRW to start, 200k KRW a month. */
const SAT: SimConfig = { startBalance: 5_000_000, monthly: 200_000, cost: 0.0015, cashRate: 0.02 };
const SAT_TAX: SimConfig = { ...SAT, tax: { rate: 0.22, exemption: 2_500_000 } };
const CORE: SimConfig = { startBalance: 24_810_000, monthly: 1_000_000, cost: 0.0015, cashRate: 0.02 };

// ─── Pools, each picked by what was true at its start date ───────────────────

/** S&P 100 members around 2010 that still have Yahoo history. */
const POOL_US = [
  'AAPL', 'ABT', 'AMGN', 'AMZN', 'AXP', 'BA', 'BAC', 'BK', 'BMY', 'C', 'CAT', 'CL', 'CMCSA', 'COF', 'COP', 'COST', 'CSCO',
  'CVS', 'CVX', 'DIS', 'DUK', 'EMR', 'EXC', 'F', 'FDX', 'GD', 'GE', 'GILD', 'GOOGL', 'HD', 'HON', 'HPQ', 'IBM', 'INTC',
  'JNJ', 'JPM', 'KO', 'LMT', 'LOW', 'MCD', 'MDT', 'MMM', 'MO', 'MRK', 'MS', 'MSFT', 'NKE', 'ORCL', 'OXY', 'PEP', 'PFE',
  'PG', 'QCOM', 'RTX', 'SLB', 'SO', 'T', 'TGT', 'TXN', 'UNH', 'UNP', 'UPS', 'USB', 'VZ', 'WFC', 'WMT', 'XOM', 'AEP',
  'ALL', 'APA', 'BAX', 'DVN', 'HAL', 'MET', 'NSC', 'WMB', 'SPG', 'AIG', 'GS', 'BRK-B', 'MA', 'V',
];
/** KOSPI large caps around 2010 that are still listed under the same code. */
const POOL_KR = [
  '005930', '000660', '005380', '005490', '012330', '051910', '015760', '066570', '000270', '055550', '105560', '096770',
  '034220', '017670', '033780', '009540', '010950', '011170', '010130', '004020', '030200', '086790', '032830', '000810',
  '006400', '009150', '010140', '042660', '000720', '047050', '003550', '034730', '001040', '097950', '051900', '090430',
  '002790', '023530', '004170', '035420', '036570', '035720', '068270', '128940', '000100', '006800', '016360', '024110',
  '029780', '078930', '006360', '011200', '003490', '034020', '012450', '000880', '009830', '011780', '001450', '005830',
  '036460', '018880', '004990', '005940', '071050', '002380', '010620', '001740', '069960', '008770', '021240', '003670',
].map((c) => `${c}.KS`);

const BASKETS: Record<string, string[]> = {
  '2010 대형주 40': [
    '005930.KS', '005380.KS', '005490.KS', '012330.KS', '051910.KS', '015760.KS', '066570.KS', '000270.KS', '055550.KS',
    '105560.KS', '096770.KS', '000660.KS', '034220.KS', '017670.KS', '033780.KS', '009540.KS', 'XOM', 'AAPL', 'MSFT',
    'BRK-B', 'WMT', 'GE', 'GOOGL', 'CVX', 'IBM', 'JPM', 'PG', 'JNJ', 'T', 'WFC', 'KO', 'PFE', 'ORCL', 'INTC', 'CSCO',
    'BAC', 'C', 'MRK', 'HPQ', 'PM',
  ],
  '2021 테마주 21': [
    'ZM', 'PTON', 'TDOC', 'ROKU', 'NIO', 'PLUG', 'MRNA', 'SHOP', 'SNOW', 'PLTR', 'XYZ', '035720.KS', '068270.KS',
    '036570.KS', '352820.KS', '247540.KQ', '035420.KS', '207940.KS', '006400.KS', '096530.KQ', '293490.KQ',
  ],
};

/** Regimes the earlier test never saw, each with names prominent going in. */
const STRESS: Array<{ label: string; from: string; to: string; syms: string[]; local?: boolean }> = [
  {
    label: '닷컴 붕괴 2000-03 ~ 2006 (미국 기술주, 달러 기준)', from: '2000-03-01', to: '2006-12-31', local: true,
    syms: ['CSCO', 'INTC', 'MSFT', 'ORCL', 'QCOM', 'AMZN', 'EBAY', 'NTAP', 'AMAT', 'KLAC', 'ADBE', 'AAPL', 'TXN', 'AMD',
      'MU', 'CIEN', 'JNPR', 'NOK', 'ERIC', 'CHKP', 'INFY', 'SAP', 'HPQ', 'IBM', 'VIAV', 'CMCSA'],
  },
  {
    label: '차화정 이후 2011-05 ~ 2016 (국내 화학·자동차·정유·조선)', from: '2011-05-01', to: '2016-12-31',
    syms: ['051910.KS', '010950.KS', '096770.KS', '005380.KS', '000270.KS', '012330.KS', '011170.KS', '011780.KS',
      '009830.KS', '010060.KS', '009540.KS', '010140.KS', '042660.KS', '010620.KS', '010130.KS', '006650.KS', '002380.KS', '004800.KS'],
  },
  {
    label: '바이오 붕괴 2015-07 ~ 2019 (국내 제약·바이오)', from: '2015-07-01', to: '2019-12-31',
    syms: ['068270.KS', '128940.KS', '086900.KQ', '084990.KQ', '096530.KQ', '085660.KQ', '006280.KS', '000100.KS',
      '069620.KS', '185750.KS', '008930.KS', '041960.KQ', '140410.KQ', '000250.KQ', '039200.KQ', '028300.KQ',
      '007570.KS', '003000.KS', '003520.KS', '170900.KS'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const sign = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%p`;
const quant = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const med = (xs: number[]) => quant(xs, 0.5);

let seed = 20261013;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const sample = <T>(xs: T[], n: number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };

const line = (name: string, r: Result) =>
  `  ${name.padEnd(28)}${pct(r.cagr).padStart(8)}${pct(r.mdd).padStart(9)}${r.sharpe.toFixed(2).padStart(7)}${((r.taxes / 1e4).toFixed(0) + '만').padStart(8)}`;
const header = () => console.log(`  ${'전략'.padEnd(28)}${'CAGR'.padStart(8)}${'MDD'.padStart(9)}${'Sharpe'.padStart(7)}${'세금'.padStart(8)}`);

// ─── Data ─────────────────────────────────────────────────────────────────────

const all = [...new Set([
  '069500.KS', 'SPY', 'QQQ', '^KS11', ...POOL_US, ...POOL_KR, ...Object.values(BASKETS).flat(), ...STRESS.flatMap((s) => s.syms),
])];
console.log(`데이터 수집: ${all.length}종목${CACHE ? ` (캐시 ${CACHE})` : ''}`);
const [fx, fetched] = await Promise.all([fetchFx(CACHE), fetchMany(all, CACHE)]);
if (fetched.missing.length) console.log(`  데이터 없음(제외): ${fetched.missing.join(', ')}`);
const bars = fetched.bars;
bars.set('069500.KS', splice(bars.get('069500.KS')!, bars.get('^KS11')!, 0.017));
bars.delete('^KS11');
const have = (xs: string[]) => xs.filter((s) => bars.has(s));

const krwMarket = buildMarket(bars, fx, '1998-01-01');
const localMarket = buildMarket(new Map(have(STRESS[0].syms).map((s) => [s, bars.get(s)!])), null, '1998-01-01');

const t0 = Date.now();
const preK = new Map<string, AlertPre>();
const preL = new Map<string, AlertPre>();
for (const s of krwMarket.assets.keys()) preK.set(s, precomputeAlerts(krwMarket.assets.get(s)!, '1999-01-01'));
for (const s of localMarket.assets.keys()) preL.set(s, precomputeAlerts(localMarket.assets.get(s)!, '1999-01-01'));
console.log(`  지표 사전계산 ${((Date.now() - t0) / 1000).toFixed(0)}초`);

/** Equal-weight `syms` under one strategy over the random-sample window. */
const runOn = (syms: string[], cfg: SimConfig, mk: (b: Weights) => Strategy) => {
  const [from, to] = windowRange(krwMarket, syms, '2011-01-01', '2099-12-31');
  return run(mk(equalWeights(syms)), krwMarket, from, to, cfg);
};

// ─── 1. Window sweep ──────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(90)}\n1. 이동평균 기간 민감도 (6~14개월) — 10개월에서만 좋으면 우연\n${'='.repeat(90)}`);
const sweepSets: Array<[string, string[], Weights | null, SimConfig, string]> = [
  ['코어 지수 (2008-)', ['069500.KS', 'SPY', 'QQQ'], { '069500.KS': 0.4, SPY: 0.3, QQQ: 0.3 }, CORE, '2008-01-01'],
  ['2010 대형주 40 (2011-)', have(BASKETS['2010 대형주 40']), null, SAT, '2011-01-01'],
  ['2021 테마주 21 (2021-02-)', have(BASKETS['2021 테마주 21']), null, SAT, '2021-02-01'],
];
for (const [label, syms, w, cfg, fromD] of sweepSets) {
  const base = w ?? equalWeights(syms);
  const [from, to] = windowRange(krwMarket, syms, fromD, '2099-12-31');
  console.log(`\n${label}`);
  header();
  console.log(line('① 현행 알람', run(liveAlerts(base, preK), krwMarket, from, to, cfg)));
  console.log(line('② 보유+연1회 리밸런싱', run(buyAndHold(base), krwMarket, from, to, cfg)));
  for (const mo of [6, 8, 10, 12, 14]) console.log(line(`③ ${mo}개월선`, run(trendFilter(base, mo), krwMarket, from, to, cfg)));
}

// ─── 2 & 4. Random baskets, before and after tax ─────────────────────────────

const pool = have([...POOL_US, ...POOL_KR]);
console.log(`\n${'='.repeat(90)}\n2. 무작위 표본 ${SAMPLES}회 — 2010 대형주 풀 ${pool.length}종목에서 20개씩, 2011-01 ~ 현재\n${'='.repeat(90)}`);
type Row = Record<'alert' | 'hold' | 't8' | 't10' | 't12', Result>;
const rowsPre: Row[] = [];
const rowsTax: Row[] = [];
const t1 = Date.now();
for (let k = 0; k < SAMPLES; k++) {
  const syms = sample(pool, 20);
  const go = (cfg: SimConfig): Row => ({
    alert: runOn(syms, cfg, (b) => liveAlerts(b, preK)),
    hold: runOn(syms, cfg, buyAndHold),
    t8: runOn(syms, cfg, (b) => trendFilter(b, 8)),
    t10: runOn(syms, cfg, (b) => trendFilter(b, 10)),
    t12: runOn(syms, cfg, (b) => trendFilter(b, 12)),
  });
  rowsPre.push(go(SAT));
  rowsTax.push(go(SAT_TAX));
  if ((k + 1) % 50 === 0) console.log(`  … ${k + 1}/${SAMPLES} (${((Date.now() - t1) / 1000).toFixed(0)}초)`);
}

const summarize = (rows: Row[], title: string) => {
  console.log(`\n${title}`);
  console.log(`  ${'전략'.padEnd(22)}${'CAGR 중앙'.padStart(10)}${'MDD 중앙'.padStart(10)}${'Sharpe 중앙'.padStart(12)}`);
  for (const [key, name] of [['alert', '① 현행 알람'], ['hold', '② 보유'], ['t8', '③ 8개월선'], ['t10', '③ 10개월선'], ['t12', '③ 12개월선']] as const) {
    console.log(`  ${name.padEnd(22)}${pct(med(rows.map((r) => r[key].cagr))).padStart(10)}${pct(med(rows.map((r) => r[key].mdd))).padStart(10)}${med(rows.map((r) => r[key].sharpe)).toFixed(2).padStart(12)}`);
  }
  for (const [vs, vsName] of [['alert', '현행 알람'], ['hold', '보유']] as const) {
    const dC = rows.map((r) => r.t10.cagr - r[vs].cagr);
    const dM = rows.map((r) => r.t10.mdd - r[vs].mdd);
    const dS = rows.map((r) => r.t10.sharpe - r[vs].sharpe);
    const win = (xs: number[]) => `${((xs.filter((x) => x > 0).length / xs.length) * 100).toFixed(0)}%`;
    console.log(`  10개월선 vs ${vsName}:`);
    console.log(`    CAGR 차이   중앙 ${sign(med(dC))}  [5%~95%: ${sign(quant(dC, 0.05))} ~ ${sign(quant(dC, 0.95))}]  우위 ${win(dC)}`);
    console.log(`    MDD 개선    중앙 ${sign(med(dM))}  [5%~95%: ${sign(quant(dM, 0.05))} ~ ${sign(quant(dM, 0.95))}]  우위 ${win(dM)}`);
    console.log(`    Sharpe 차이 중앙 ${med(dS) >= 0 ? '+' : ''}${med(dS).toFixed(2)}  우위 ${win(dS)}`);
  }
};
summarize(rowsPre, '세전');
console.log(`\n${'='.repeat(90)}\n4. 세금 반영 (해외주식 양도세 22%, 연 250만 공제) — 같은 표본`);
summarize(rowsTax, '세후');
console.log(`  표본당 세금 중앙: 알람 ${(med(rowsTax.map((r) => r.alert.taxes)) / 1e4).toFixed(0)}만 / 보유 ${(med(rowsTax.map((r) => r.hold.taxes)) / 1e4).toFixed(0)}만 / 10개월선 ${(med(rowsTax.map((r) => r.t10.taxes)) / 1e4).toFixed(0)}만`);

// ─── 3. Regimes ───────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(90)}\n3. 다른 하락장\n${'='.repeat(90)}`);
for (const st of STRESS) {
  const m = st.local ? localMarket : krwMarket;
  const pre = st.local ? preL : preK;
  const syms = have(st.syms).filter((s) => m.assets.has(s));
  const [from, to] = windowRange(m, syms, st.from, st.to);
  const base = equalWeights(syms);
  console.log(`\n${st.label}  — ${syms.length}종목, ${m.cal[from]} ~ ${m.cal[to]}`);
  header();
  console.log(line('① 현행 알람', run(liveAlerts(base, pre), m, from, to, SAT)));
  console.log(line('② 보유+연1회 리밸런싱', run(buyAndHold(base), m, from, to, SAT)));
  for (const mo of [8, 10, 12]) console.log(line(`③ ${mo}개월선`, run(trendFilter(base, mo), m, from, to, SAT)));
}

console.log('\n※ 시간가중 수익률 기준. 배당 포함, 신호 다음 거래일 종가 체결, 편도 비용 0.15%, 현금 이자 연 2%.');
console.log('※ 상장폐지·합병 종목은 데이터가 없어 모든 풀에서 빠짐 (생존 편향 축소, 제거 아님).');
