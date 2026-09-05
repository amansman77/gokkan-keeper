import type { D1Database } from '@cloudflare/workers-types';

const DEFAULT_YAHOO_CHART_BASE_URL = 'https://query2.finance.yahoo.com/v8/finance/chart';
const YAHOO_REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; GokkanKeeper/1.0; +https://gokkan-keeper.yetimates.com)',
};
const CACHE_TTL_MINUTES = 30;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface WeeklyPoint {
  date: string;
  value: number;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number | null;
  changeRate: number | null;
  asOfDate: string;
  weeklySeries: WeeklyPoint[];
}

const WEEKLY_SERIES_WEEKS = 8;

const INDEX_CONFIGS: { symbol: string; name: string; multiplier?: number }[] = [
  { symbol: '^KS11', name: 'KOSPI' },
  { symbol: '^KQ11', name: 'KOSDAQ' },
  { symbol: '^IXIC', name: 'NASDAQ' },
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^VIX', name: 'VIX' },
  { symbol: 'KRW=X', name: 'USD/KRW' },
  { symbol: 'EURKRW=X', name: 'EUR/KRW' },
  // Quoted per 100 JPY, matching Korean market convention (JPY/KRW per 1 unit is too small to read).
  { symbol: 'JPYKRW=X', name: 'JPY100/KRW', multiplier: 100 },
  { symbol: 'CNYKRW=X', name: 'CNY/KRW' },
];

function getTodayKST(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function toKstDate(unixSec: number): string {
  return new Date(unixSec * 1000 + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function subtractOneDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Yahoo Finance는 KRX 일봉을 다음 UTC 자정 타임스탬프에 저장한다.
// KST 변환 시 "오늘" 날짜로 보이면 실제 거래일은 하루 전이므로 보정한다.
function resolveAsOfDate(unixSec: number): string {
  const kstDate = toKstDate(unixSec);
  return kstDate >= getTodayKST() ? subtractOneDay(kstDate) : kstDate;
}

interface CachedData {
  value: number;
  change: number | null;
  changeRate: number | null;
  asOfDate: string;
}

async function getCached(db: D1Database | undefined, key: string): Promise<CachedData | null | undefined> {
  if (!db) return undefined;
  const row = await db
    .prepare('SELECT quote_json, is_not_found FROM gk_quote_cache WHERE cache_key = ? AND expires_at > ?')
    .bind(key, new Date().toISOString())
    .first<{ quote_json: string | null; is_not_found: number }>();
  if (!row) return undefined;
  if (row.is_not_found) return null;
  try { return JSON.parse(row.quote_json!) as CachedData; } catch { return undefined; }
}

async function setCached(db: D1Database | undefined, key: string, data: CachedData | null): Promise<void> {
  if (!db) return;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
  await db
    .prepare(`
      INSERT INTO gk_quote_cache (cache_key, short_code, operation, quote_json, is_not_found, fetched_at, expires_at)
      VALUES (?, ?, 'MARKET_INDEX', ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        quote_json = excluded.quote_json,
        is_not_found = excluded.is_not_found,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at
    `)
    .bind(key, key, data ? JSON.stringify(data) : null, data ? 0 : 1, now, expires)
    .run();
}

async function getCachedSeries(db: D1Database | undefined, key: string): Promise<WeeklyPoint[] | undefined> {
  if (!db) return undefined;
  const row = await db
    .prepare('SELECT quote_json FROM gk_quote_cache WHERE cache_key = ? AND expires_at > ? AND is_not_found = 0')
    .bind(key, new Date().toISOString())
    .first<{ quote_json: string | null }>();
  if (!row) return undefined;
  try { return JSON.parse(row.quote_json!) as WeeklyPoint[]; } catch { return undefined; }
}

async function setCachedSeries(db: D1Database | undefined, key: string, data: WeeklyPoint[]): Promise<void> {
  if (!db) return;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
  await db
    .prepare(`
      INSERT INTO gk_quote_cache (cache_key, short_code, operation, quote_json, is_not_found, fetched_at, expires_at)
      VALUES (?, ?, 'MARKET_INDEX_WEEKLY', ?, 0, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        quote_json = excluded.quote_json,
        is_not_found = excluded.is_not_found,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at
    `)
    .bind(key, key, JSON.stringify(data), now, expires)
    .run();
}

async function fetchIndexWeeklySeries(
  symbol: string,
  chartBaseUrl: string,
  db?: D1Database,
  multiplier = 1,
): Promise<WeeklyPoint[]> {
  const cacheKey = `MARKET_INDEX_WEEKLY:${symbol}`;
  const cached = await getCachedSeries(db, cacheKey);
  if (cached !== undefined) return cached;

  const url = new URL(`${chartBaseUrl}/${encodeURIComponent(symbol)}`);
  url.searchParams.set('interval', '1wk');
  url.searchParams.set('range', '3mo');
  url.searchParams.set('includePrePost', 'false');

  const response = await fetch(url.toString(), { headers: YAHOO_REQUEST_HEADERS });
  if (!response.ok) return [];

  const payload = await response.json() as any;
  const result = payload?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];

  const points: WeeklyPoint[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (typeof closes[i] === 'number' && typeof timestamps[i] === 'number') {
      points.push({ date: resolveAsOfDate(timestamps[i]), value: (closes[i] as number) * multiplier });
    }
  }

  const series = points.slice(-WEEKLY_SERIES_WEEKS);
  await setCachedSeries(db, cacheKey, series);
  return series;
}

async function fetchIndexQuote(
  symbol: string,
  chartBaseUrl: string,
  db?: D1Database,
  multiplier = 1,
): Promise<CachedData | null> {
  const cacheKey = `MARKET_INDEX:${symbol}`;
  const cached = await getCached(db, cacheKey);
  if (cached !== undefined) return cached;

  const url = new URL(`${chartBaseUrl}/${encodeURIComponent(symbol)}`);
  url.searchParams.set('interval', '1d');
  url.searchParams.set('range', '5d');
  url.searchParams.set('includePrePost', 'false');

  const response = await fetch(url.toString(), { headers: YAHOO_REQUEST_HEADERS });
  if (!response.ok) {
    // 요청 실패 시 캐시하지 않고 null 반환
    return null;
  }

  const payload = await response.json() as any;
  const result = payload?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];

  // 가장 최근 유효(non-null) 종가 두 개를 수집해 전일 종가와 등락 계산
  const valid: { close: number; ts: number }[] = [];
  for (let i = closes.length - 1; i >= 0 && valid.length < 2; i--) {
    if (typeof closes[i] === 'number' && typeof timestamps[i] === 'number') {
      valid.push({ close: closes[i] as number, ts: timestamps[i] });
    }
  }

  if (valid.length === 0) {
    await setCached(db, cacheKey, null);
    return null;
  }

  const latest = valid[0];
  const prev = valid[1] ?? null;

  const change = prev ? (latest.close - prev.close) * multiplier : null;
  const changeRate = prev ? ((latest.close - prev.close) / prev.close) * 100 : null;
  const asOfDate = resolveAsOfDate(latest.ts);

  const data: CachedData = { value: latest.close * multiplier, change, changeRate, asOfDate };
  await setCached(db, cacheKey, data);
  return data;
}

export async function getMarketIndices(chartBaseUrl?: string, db?: D1Database): Promise<MarketIndex[]> {
  const baseUrl = chartBaseUrl || DEFAULT_YAHOO_CHART_BASE_URL;

  const results = await Promise.allSettled(
    INDEX_CONFIGS.map(async ({ symbol, name, multiplier }) => {
      const [data, weeklySeries] = await Promise.all([
        fetchIndexQuote(symbol, baseUrl, db, multiplier),
        fetchIndexWeeklySeries(symbol, baseUrl, db, multiplier),
      ]);
      if (!data) return null;
      return { symbol, name, ...data, weeklySeries } as MarketIndex;
    }),
  );

  return results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((v): v is MarketIndex => v !== null);
}
