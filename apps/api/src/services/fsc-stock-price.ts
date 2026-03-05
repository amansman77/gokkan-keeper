import type { D1Database } from '@cloudflare/workers-types';
import type { Position } from '@gokkan-keeper/shared';
import type { Env } from '../types';

const DEFAULT_STOCK_BASE_URL = 'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService';
const DEFAULT_SECURITIES_PRODUCT_BASE_URL = 'https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService';
const KRX_MARKETS = new Set(['KRX', 'KOSDAQ', 'KOSPI', 'KONEX']);
const ETF_ASSET_TYPES = new Set(['ETF', 'FUND', 'REIT']);
const QUOTE_CACHE_TTL_HOURS = 6;
const NOT_FOUND_CACHE_TTL_MINUTES = 30;

type QuoteOperation = 'getStockPriceInfo' | 'getSecuritiesPriceInfo' | 'getETFPriceInfo';

interface QuoteItem {
  basDt?: string;
  srtnCd?: string;
  itmsNm?: string;
  mrktCtg?: string;
  clpr?: string | number;
  vs?: string | number;
  fltRt?: string | number;
}

export interface PositionQuote {
  shortCode: string;
  name: string | null;
  marketCategory: string | null;
  closePrice: number;
  change: number | null;
  changeRate: number | null;
  asOfDate: string;
  operation: QuoteOperation;
}

interface CachedQuoteRow {
  quote_json: string | null;
  is_not_found: number;
  expires_at: string;
}

export function normalizeShortCode(symbol: string): string | null {
  const trimmed = symbol.trim().toUpperCase();
  if (/^\d{6}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(\d{6})/);
  return match ? match[1] : null;
}

function toIsoDate(basDt?: string): string | null {
  if (!basDt || !/^\d{8}$/.test(basDt)) return null;
  return `${basDt.slice(0, 4)}-${basDt.slice(4, 6)}-${basDt.slice(6, 8)}`;
}

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeItemShortCode(value?: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

function getBeginBaseDate(daysBack = 60): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function normalizeServiceKey(serviceKey: string): string {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function getFutureIso(hours = 0, minutes = 0): string {
  const now = new Date();
  now.setUTCMinutes(now.getUTCMinutes() + minutes);
  now.setUTCHours(now.getUTCHours() + hours);
  return now.toISOString();
}

function getCacheKey(shortCode: string, operation: QuoteOperation): string {
  return `${operation}:${shortCode}`;
}

function getPreferredOperations(position?: Pick<Position, 'assetType'> | null): QuoteOperation[] {
  const assetType = position?.assetType?.toUpperCase();
  if (assetType && ETF_ASSET_TYPES.has(assetType)) {
    return ['getETFPriceInfo', 'getSecuritiesPriceInfo', 'getStockPriceInfo'];
  }
  if (assetType === 'STOCK') {
    return ['getStockPriceInfo', 'getSecuritiesPriceInfo'];
  }
  return ['getStockPriceInfo', 'getSecuritiesPriceInfo', 'getETFPriceInfo'];
}

export class FscStockPriceService {
  private readonly stockBaseUrl: string;
  private readonly securitiesProductBaseUrl: string;
  private readonly stockServiceKey?: string;

  constructor(
    stockServiceKey?: string,
    stockBaseUrl = DEFAULT_STOCK_BASE_URL,
    private readonly db?: D1Database,
    securitiesProductBaseUrl = DEFAULT_SECURITIES_PRODUCT_BASE_URL,
  ) {
    this.stockServiceKey = stockServiceKey;
    this.stockBaseUrl = stockBaseUrl;
    this.securitiesProductBaseUrl = securitiesProductBaseUrl;
  }

  isEnabled(): boolean {
    return !!this.stockServiceKey;
  }

  supports(position: Position): boolean {
    const code = normalizeShortCode(position.symbol);
    if (!code) return false;

    if (!position.market) return true;
    return KRX_MARKETS.has(position.market.toUpperCase());
  }

  async getQuotesForPositions(positions: Position[]): Promise<Map<string, PositionQuote>> {
    if (!this.isEnabled()) return new Map();

    const entries = await Promise.all(
      positions
        .filter((position) => this.supports(position))
        .map(async (position) => {
          const shortCode = normalizeShortCode(position.symbol);
          if (!shortCode) return null;
          return [shortCode, await this.getQuote(shortCode, position)] as const;
        })
    );

    return new Map(entries.filter((entry): entry is readonly [string, PositionQuote] => !!entry?.[1]));
  }

  async getQuoteBySymbol(symbol: string, position?: Pick<Position, 'assetType'> | null): Promise<PositionQuote | null> {
    const shortCode = normalizeShortCode(symbol);
    if (!shortCode || !this.isEnabled()) return null;
    return this.getQuote(shortCode, position);
  }

  private async getQuote(shortCode: string, position?: Pick<Position, 'assetType'> | null): Promise<PositionQuote | null> {
    const operations = getPreferredOperations(position);
    for (const operation of operations) {
      const quote = await this.fetchQuote(shortCode, operation);
      if (quote) return quote;
    }
    return null;
  }

  private async fetchQuote(shortCode: string, operation: QuoteOperation): Promise<PositionQuote | null> {
    const serviceKey = this.getServiceKey(operation);
    if (!serviceKey) return null;

    const cached = await this.getCachedQuote(shortCode, operation);
    if (cached !== undefined) {
      return cached;
    }

    const baseUrl = operation === 'getETFPriceInfo'
      ? this.securitiesProductBaseUrl
      : this.stockBaseUrl;
    const url = new URL(`${baseUrl}/${operation}`);
    url.searchParams.set('serviceKey', normalizeServiceKey(serviceKey));
    url.searchParams.set('numOfRows', '100');
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('resultType', 'json');
    url.searchParams.set('likeSrtnCd', shortCode);
    url.searchParams.set('beginBasDt', getBeginBaseDate());

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? this.getUnauthorizedMessage(operation)
          : `FSC stock API request failed with ${response.status}`
      );
    }

    const payload = await response.json() as any;
    const resultCode = payload?.response?.header?.resultCode;
    if (resultCode && resultCode !== '00') {
      throw new Error(payload?.response?.header?.resultMsg || 'FSC stock API returned an error');
    }

    const rawItems = payload?.response?.body?.items?.item;
    const items: QuoteItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    const exactItems = items.filter((item) => {
      const normalizedCode = normalizeItemShortCode(item.srtnCd);
      return normalizedCode === shortCode || normalizedCode.endsWith(shortCode);
    });
    const candidateItems = exactItems.length > 0 ? exactItems : items;
    const matchedItems = candidateItems
      .map((item) => ({
        item,
        isoDate: toIsoDate(item.basDt),
      }))
      .filter((entry): entry is { item: QuoteItem; isoDate: string } => !!entry.isoDate)
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));

    const latest = matchedItems[0]?.item;
    if (!latest) {
      await this.setCachedQuote(shortCode, operation, null);
      return null;
    }

    const closePrice = toNumber(latest.clpr);
    const asOfDate = toIsoDate(latest.basDt);
    if (closePrice === null || !asOfDate) {
      await this.setCachedQuote(shortCode, operation, null);
      return null;
    }

    const quote = {
      shortCode,
      name: latest.itmsNm ?? null,
      marketCategory: latest.mrktCtg ?? null,
      closePrice,
      change: toNumber(latest.vs),
      changeRate: toNumber(latest.fltRt),
      asOfDate,
      operation,
    };

    await this.setCachedQuote(shortCode, operation, quote);
    return quote;
  }

  private async getCachedQuote(shortCode: string, operation: QuoteOperation): Promise<PositionQuote | null | undefined> {
    if (!this.db) return undefined;

    const now = new Date().toISOString();
    const cacheKey = getCacheKey(shortCode, operation);
    const row = await this.db
      .prepare(`
        SELECT quote_json, is_not_found, expires_at
        FROM gk_quote_cache
        WHERE cache_key = ? AND expires_at > ?
      `)
      .bind(cacheKey, now)
      .first<CachedQuoteRow>();

    if (!row) return undefined;
    if (row.is_not_found === 1) return null;
    if (!row.quote_json) return null;

    try {
      return JSON.parse(row.quote_json) as PositionQuote;
    } catch {
      return undefined;
    }
  }

  private async setCachedQuote(shortCode: string, operation: QuoteOperation, quote: PositionQuote | null): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const expiresAt = quote
      ? getFutureIso(QUOTE_CACHE_TTL_HOURS)
      : getFutureIso(0, NOT_FOUND_CACHE_TTL_MINUTES);
    const cacheKey = getCacheKey(shortCode, operation);

    await this.db
      .prepare(`
        INSERT INTO gk_quote_cache (cache_key, short_code, operation, quote_json, is_not_found, fetched_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          quote_json = excluded.quote_json,
          is_not_found = excluded.is_not_found,
          fetched_at = excluded.fetched_at,
          expires_at = excluded.expires_at
      `)
      .bind(
        cacheKey,
        shortCode,
        operation,
        quote ? JSON.stringify(quote) : null,
        quote ? 0 : 1,
        now,
        expiresAt,
      )
      .run();
  }

  private getServiceKey(operation: QuoteOperation): string | undefined {
    return this.stockServiceKey;
  }

  private getUnauthorizedMessage(operation: QuoteOperation): string {
    if (operation === 'getETFPriceInfo') {
      return 'FSC ETF API request failed with 401. Check whether FSC_STOCK_API_SERVICE_KEY is the decoded key from data.go.kr.';
    }
    return 'FSC stock API request failed with 401. Check whether FSC_STOCK_API_SERVICE_KEY is the decoded key from data.go.kr.';
  }
}

export function enrichPositionWithQuote(position: Position, quote?: PositionQuote | null): Position {
  if (!quote) {
    return {
      ...position,
      currentPriceSource: position.currentValue !== null && position.currentValue !== undefined ? 'MANUAL' : null,
      currentUnitPrice:
        position.quantity !== null && position.quantity !== undefined
          ? position.currentValue ?? null
          : null,
      currentMarketValue:
        position.currentValue !== null && position.currentValue !== undefined
          ? (position.quantity !== null && position.quantity !== undefined
            ? position.quantity * position.currentValue
            : position.currentValue)
          : null,
    };
  }

  return {
    ...position,
    currentUnitPrice: quote.closePrice,
    currentMarketValue:
      position.quantity !== null && position.quantity !== undefined
        ? position.quantity * quote.closePrice
        : null,
    currentPriceAsOf: quote.asOfDate,
    currentPriceChange: quote.change,
    currentPriceChangeRate: quote.changeRate,
    currentPriceSource: 'FSC_STOCK_PRICE_API',
  };
}

export async function enrichPositionsWithLiveQuotes(positions: Position[], env: Env): Promise<Position[]> {
  const quoteService = new FscStockPriceService(
    env.FSC_STOCK_API_SERVICE_KEY,
    env.FSC_STOCK_API_BASE_URL,
    env.DB,
    env.FSC_SECURITIES_PRODUCT_API_BASE_URL,
  );

  if (!quoteService.isEnabled()) {
    return positions.map((position) => enrichPositionWithQuote(position, null));
  }

  try {
    const quotes = await quoteService.getQuotesForPositions(positions);
    return positions.map((position) => {
      const shortCode = normalizeShortCode(position.symbol);
      return enrichPositionWithQuote(position, shortCode ? quotes.get(shortCode) : null);
    });
  } catch (error) {
    console.error('Failed to fetch FSC stock quotes', error);
    return positions.map((position) => enrichPositionWithQuote(position, null));
  }
}
