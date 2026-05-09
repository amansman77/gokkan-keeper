import type { D1Database } from '@cloudflare/workers-types';
import { normalizeYahooSymbol } from './yahoo-finance';

const KRX_SUFFIX: Record<string, string> = {
  KOSPI: '.KS',
  KRX: '.KS',
  KOSDAQ: '.KQ',
  KONEX: '.KQ',
};

function resolveSymbol(symbol: string, market: string | null): string | null {
  const normalizedMarket = market?.trim().toUpperCase() ?? null;
  const suffix = normalizedMarket ? KRX_SUFFIX[normalizedMarket] : null;
  if (suffix) {
    const code = symbol.trim().replace(/\D/g, '').slice(0, 6);
    return code.length === 6 ? `${code}${suffix}` : null;
  }
  return normalizeYahooSymbol(symbol, market);
}

const DEFAULT_YAHOO_CHART_BASE_URL = 'https://query2.finance.yahoo.com/v8/finance/chart';
const YAHOO_REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; GokkanKeeper/1.0; +https://gokkan-keeper.yetimates.com)',
};
const CACHE_TTL_HOURS = 6;

export interface TechnicalIndicatorResult {
  symbol: string;
  asOfDate: string;
  rsi: number | null;
  macdOsc: number | null;
  prevMacdOsc: number | null;
  obv: number | null;
  adx: number | null;
  diPlus: number | null;
  diMinus: number | null;
  ma5: number | null;
  ma20: number | null;
  close: number | null;
  open: number | null;
  volume: number | null;
  avgVolume20: number | null;
  fiveDayReturn: number | null;
}

// ─── EMA ──────────────────────────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = new Array(values.length).fill(0);
  result[period - 1] = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k);
  }
  return result.slice(period - 1);
}

// Wilder's smoothing — same length as input, null-padded before the warm-up period
function wilderSmoothAligned(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    const prev = result[i - 1];
    result[i] = prev == null ? null : ((prev * (period - 1)) + values[i]) / period;
  }
  return result;
}

// Wilder's smoothing for nullable input — skips nulls, preserves original array alignment
function wilderSmoothNullable(values: Array<number | null>, period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  const valid = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null);
  if (valid.length < period) return result;
  let sum = 0;
  for (let j = 0; j < period; j++) sum += valid[j].v;
  result[valid[period - 1].i] = sum / period;
  for (let j = period; j < valid.length; j++) {
    const idx = valid[j].i;
    const prev = result[valid[j - 1].i];
    result[idx] = prev == null ? null : ((prev * (period - 1)) + valid[j].v) / period;
  }
  return result;
}

function lastValue(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i];
  }
  return null;
}

// ─── RSI(14) ──────────────────────────────────────────────────────────────────

function calcRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = changes.map((c) => Math.max(c, 0));
  const losses = changes.map((c) => Math.max(-c, 0));

  const avgGain = lastValue(wilderSmoothAligned(gains, period));
  const avgLoss = lastValue(wilderSmoothAligned(losses, period));
  if (avgGain == null || avgLoss == null) return null;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// ─── MACD OSC (12, 26, 9) ─────────────────────────────────────────────────────

function calcMacdOsc(closes: number[]): number | null {
  if (closes.length < 35) return null;
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
  const signal = ema(macdLine, 9);

  if (signal.length === 0) return null;
  return macdLine[macdLine.length - 1] - signal[signal.length - 1];
}

function calcPrevMacdOsc(closes: number[]): number | null {
  if (closes.length < 36) return null;
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
  const signal = ema(macdLine, 9);
  if (signal.length < 2) return null;
  return macdLine[macdLine.length - 2] - signal[signal.length - 2];
}

// ─── OBV ──────────────────────────────────────────────────────────────────────

function calcObv(closes: number[], volumes: number[]): number | null {
  if (closes.length < 2 || volumes.length < closes.length) return null;
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }
  return obv;
}

// ─── ADX(14) ──────────────────────────────────────────────────────────────────

function calcAdxFromDx(dx: Array<number | null>, period = 14): Array<number | null> {
  const adx: Array<number | null> = Array(dx.length).fill(null);
  const valid = dx
    .map((value, index) => ({ value, index }))
    .filter((x): x is { value: number; index: number } => x.value != null);
  if (valid.length < period) return adx;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += valid[i].value;
  adx[valid[period - 1].index] = sum / period;
  for (let i = period; i < valid.length; i++) {
    const currentIndex = valid[i].index;
    const prevAdx = adx[valid[i - 1].index];
    if (prevAdx == null) continue;
    adx[currentIndex] = ((prevAdx * (period - 1)) + valid[i].value) / period;
  }
  return adx;
}

function calcAdx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): { adx: number | null; diPlus: number | null; diMinus: number | null } {
  const n = closes.length;
  if (n < period * 2) return { adx: null, diPlus: null, diMinus: null };

  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];

  for (let i = 1; i < n; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    plusDm.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDm.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
  }

  const smoothTr = wilderSmoothAligned(tr, period);
  const smoothPlusDm = wilderSmoothAligned(plusDm, period);
  const smoothMinusDm = wilderSmoothAligned(minusDm, period);

  const diPlus = smoothPlusDm.map((v, i) =>
    v != null && smoothTr[i] != null && smoothTr[i]! !== 0
      ? (100 * v) / smoothTr[i]!
      : null
  );
  const diMinus = smoothMinusDm.map((v, i) =>
    v != null && smoothTr[i] != null && smoothTr[i]! !== 0
      ? (100 * v) / smoothTr[i]!
      : null
  );
  const dx = diPlus.map((p, i) => {
    const m = diMinus[i];
    if (p == null || m == null || p + m === 0) return null;
    return (100 * Math.abs(p - m)) / (p + m);
  });

  const adxArr = calcAdxFromDx(dx, period);

  return {
    adx: lastValue(adxArr),
    diPlus: lastValue(diPlus),
    diMinus: lastValue(diMinus),
  };
}

// ─── Weekly aggregation (daily bars → weekly OHLCV) ───────────────────────────

type OhlcvRow = { ts: number; open: number; close: number; high: number; low: number; volume: number };

function aggregateWeekly(rows: OhlcvRow[]): OhlcvRow[] {
  if (rows.length === 0) return [];
  const weekMap = new Map<string, OhlcvRow[]>();
  for (const row of rows) {
    const d = new Date(row.ts * 1000);
    const day = d.getUTCDay();
    const daysToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysToMonday));
    const key = monday.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(row);
  }
  const result: OhlcvRow[] = [];
  for (const [, dayRows] of [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    result.push({
      ts: dayRows[dayRows.length - 1].ts,
      open: dayRows[0].open,
      high: Math.max(...dayRows.map((r) => r.high)),
      low: Math.min(...dayRows.map((r) => r.low)),
      close: dayRows[dayRows.length - 1].close,
      volume: dayRows.reduce((sum, r) => sum + r.volume, 0),
    });
  }
  return result;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

async function getCached(db: D1Database | undefined, key: string): Promise<TechnicalIndicatorResult | null | undefined> {
  if (!db) return undefined;
  const row = await db
    .prepare('SELECT quote_json, is_not_found FROM gk_quote_cache WHERE cache_key = ? AND expires_at > ?')
    .bind(key, new Date().toISOString())
    .first<{ quote_json: string | null; is_not_found: number }>();
  if (!row) return undefined;
  if (row.is_not_found) return null;
  try { return JSON.parse(row.quote_json!) as TechnicalIndicatorResult; } catch { return undefined; }
}

async function setCached(db: D1Database | undefined, key: string, data: TechnicalIndicatorResult | null): Promise<void> {
  if (!db) return;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await db
    .prepare(`
      INSERT INTO gk_quote_cache (cache_key, short_code, operation, quote_json, is_not_found, fetched_at, expires_at)
      VALUES (?, ?, 'INDICATORS', ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        quote_json = excluded.quote_json,
        is_not_found = excluded.is_not_found,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at
    `)
    .bind(key, key, data ? JSON.stringify(data) : null, data ? 0 : 1, now, expires)
    .run();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export type IndicatorInterval = '1d' | '1wk';

export async function getTechnicalIndicators(
  symbol: string,
  market: string | null,
  interval: IndicatorInterval = '1d',
  chartBaseUrl?: string,
  db?: D1Database,
): Promise<TechnicalIndicatorResult | null> {
  const resolvedSymbol = resolveSymbol(symbol, market);
  if (!resolvedSymbol) return null;

  const cacheKey = `INDICATORS:${interval}:${resolvedSymbol}`;
  const cached = await getCached(db, cacheKey);
  if (cached !== undefined) return cached;

  const baseUrl = chartBaseUrl || DEFAULT_YAHOO_CHART_BASE_URL;
  const url = new URL(`${baseUrl}/${encodeURIComponent(resolvedSymbol)}`);
  // Always fetch daily bars; weekly is aggregated from daily for accuracy
  url.searchParams.set('interval', '1d');
  url.searchParams.set('range', interval === '1wk' ? '2y' : '3y');
  url.searchParams.set('includePrePost', 'false');

  const response = await fetch(url.toString(), { headers: YAHOO_REQUEST_HEADERS });
  if (!response.ok) return null;

  const payload = await response.json() as any;
  const result = payload?.chart?.result?.[0];
  if (!result) return null;

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const rawOpens: (number | null)[] = quote.open ?? [];
  const rawCloses: (number | null)[] = quote.close ?? [];
  const rawHighs: (number | null)[] = quote.high ?? [];
  const rawLows: (number | null)[] = quote.low ?? [];
  const rawVolumes: (number | null)[] = quote.volume ?? [];

  const dailyRows: OhlcvRow[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = rawOpens[i];
    const close = rawCloses[i];
    const high = rawHighs[i];
    const low = rawLows[i];
    const volume = rawVolumes[i];
    if (
      typeof open === 'number' && typeof close === 'number' &&
      typeof high === 'number' && typeof low === 'number' &&
      typeof volume === 'number'
    ) {
      dailyRows.push({ ts: timestamps[i], open, close, high, low, volume });
    }
  }

  const rows = interval === '1wk' ? aggregateWeekly(dailyRows) : dailyRows;

  if (rows.length < 30) {
    await setCached(db, cacheKey, null);
    return null;
  }

  const closes = rows.map((r) => r.close);
  const highs = rows.map((r) => r.high);
  const lows = rows.map((r) => r.low);
  const volumes = rows.map((r) => r.volume);
  const last = rows[rows.length - 1];
  const asOfDate = new Date(last.ts * 1000).toISOString().slice(0, 10);

  const rsi = calcRsi(closes);
  const macdOsc = calcMacdOsc(closes);
  const obv = calcObv(closes, volumes);
  const { adx, diPlus, diMinus } = calcAdx(highs, lows, closes);

  // Extra fields for alert engine (cached together to avoid extra fetches)
  const prevMacdOsc = calcPrevMacdOsc(closes);
  const ma5 = closes.length >= 5 ? closes.slice(-5).reduce((a, b) => a + b) / 5 : null;
  const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b) / 20 : null;
  const avgVolume20 = volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b) / 20 : null;
  const fiveDayReturn = closes.length >= 6
    ? (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]
    : null;

  const data: TechnicalIndicatorResult = {
    symbol: resolvedSymbol, asOfDate, rsi, macdOsc, prevMacdOsc, obv, adx, diPlus, diMinus,
    ma5, ma20, close: last.close, open: last.open, volume: last.volume, avgVolume20, fiveDayReturn,
  };
  await setCached(db, cacheKey, data);
  return data;
}
