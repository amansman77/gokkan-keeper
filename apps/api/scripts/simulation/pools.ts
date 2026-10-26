/**
 * Symbol pools for the portfolio backtests, each picked by what was true at
 * its start date rather than by what did well since (survivorship is reduced,
 * not removed: names delisted or merged since have no Yahoo history).
 */

/** S&P 100 members around 2010 that still have Yahoo history. */
export const POOL_US = [
  'AAPL', 'ABT', 'AMGN', 'AMZN', 'AXP', 'BA', 'BAC', 'BK', 'BMY', 'C', 'CAT', 'CL', 'CMCSA', 'COF', 'COP', 'COST', 'CSCO',
  'CVS', 'CVX', 'DIS', 'DUK', 'EMR', 'EXC', 'F', 'FDX', 'GD', 'GE', 'GILD', 'GOOGL', 'HD', 'HON', 'HPQ', 'IBM', 'INTC',
  'JNJ', 'JPM', 'KO', 'LMT', 'LOW', 'MCD', 'MDT', 'MMM', 'MO', 'MRK', 'MS', 'MSFT', 'NKE', 'ORCL', 'OXY', 'PEP', 'PFE',
  'PG', 'QCOM', 'RTX', 'SLB', 'SO', 'T', 'TGT', 'TXN', 'UNH', 'UNP', 'UPS', 'USB', 'VZ', 'WFC', 'WMT', 'XOM', 'AEP',
  'ALL', 'APA', 'BAX', 'DVN', 'HAL', 'MET', 'NSC', 'WMB', 'SPG', 'AIG', 'GS', 'BRK-B', 'MA', 'V',
];
/** KOSPI large caps around 2010 that are still listed under the same code. */
export const POOL_KR = [
  '005930', '000660', '005380', '005490', '012330', '051910', '015760', '066570', '000270', '055550', '105560', '096770',
  '034220', '017670', '033780', '009540', '010950', '011170', '010130', '004020', '030200', '086790', '032830', '000810',
  '006400', '009150', '010140', '042660', '000720', '047050', '003550', '034730', '001040', '097950', '051900', '090430',
  '002790', '023530', '004170', '035420', '036570', '035720', '068270', '128940', '000100', '006800', '016360', '024110',
  '029780', '078930', '006360', '011200', '003490', '034020', '012450', '000880', '009830', '011780', '001450', '005830',
  '036460', '018880', '004990', '005940', '071050', '002380', '010620', '001740', '069960', '008770', '021240', '003670',
].map((c) => `${c}.KS`);

export const BASKETS: Record<string, string[]> = {
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
export const STRESS: Array<{ label: string; from: string; to: string; syms: string[]; local?: boolean }> = [
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

