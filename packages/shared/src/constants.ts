export const CURRENCIES = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'] as const;

export const GRANARY_PURPOSES = [
  '비상금',
  '가계',
  '코인',
  '아이들',
  '기타',
] as const;

export const DEFAULT_OWNER = 'default';

export const JUDGMENT_ACTIONS = ['BUY', 'SELL', 'HOLD', 'REBALANCE', 'WATCH'] as const;

export const JUDGMENT_ASSET_TYPES = [
  'STOCK',
  'ETF',
  'CRYPTO',
  'CASH',
  'BOND',
  'COMMODITY',
  'FX',
] as const;

export const JUDGMENT_EMOTION_STATES = [
  'CALM',
  'ANXIOUS',
  'GREEDY',
  'FOMO',
  'TIRED',
  'CONFIDENT',
  'UNCERTAIN',
] as const;

export const JUDGMENT_TIME_HORIZONS = ['DAYS', 'WEEKS', 'MONTHS', 'YEARS'] as const;

export const JUDGMENT_STRATEGY_TAGS = [
  'TREND',
  'MEAN_REVERSION',
  'DIVIDEND',
  'HEDGE',
  'MACRO',
  'EVENT',
  'VALUE',
  'GROWTH',
  'CASH_MANAGEMENT',
] as const;

export const JUDGMENT_REF_TYPES = ['CHART', 'NEWS', 'NOTE', 'LINK'] as const;

export const POSITION_MARKETS = [
  'KRX',
  'KOSDAQ',
  'NASDAQ',
  'NYSE',
  'AMEX',
  'TSE',
  'HKEX',
  'SSE',
  'SZSE',
  'CRYPTO',
] as const;

export const POSITION_ASSET_TYPES = [
  'STOCK',
  'ETF',
  'CRYPTO',
  'CASH',
  'BOND',
  'COMMODITY',
  'FX',
] as const;
