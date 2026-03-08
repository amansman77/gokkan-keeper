import type { D1Database } from '@cloudflare/workers-types';
import type { Position } from '@gokkan-keeper/shared';
import { getCacheKey, getCachedQuote, setCachedQuote } from './quote-cache';
import type { PositionQuote, QuoteLookupInput } from './quote-types';

const DEFAULT_STOCK_BASE_URL = 'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService';
const DEFAULT_SECURITIES_PRODUCT_BASE_URL = 'https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService';
const KRX_MARKETS = new Set(['KRX', 'KOSDAQ', 'KOSPI', 'KONEX']);
const ETF_ASSET_TYPES = new Set(['ETF', 'FUND', 'REIT']);

type FscQuoteOperation = 'getStockPriceInfo' | 'getSecuritiesPriceInfo' | 'getETFPriceInfo';

interface QuoteItem {
  basDt?: string;
  srtnCd?: string;
  itmsNm?: string;
  mrktCtg?: string;
  clpr?: string | number;
  vs?: string | number;
  fltRt?: string | number;
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

function getPreferredOperations(input?: Pick<QuoteLookupInput, 'assetType'> | null): FscQuoteOperation[] {
  const assetType = input?.assetType?.toUpperCase();
  if (assetType && ETF_ASSET_TYPES.has(assetType)) {
    return ['getETFPriceInfo', 'getSecuritiesPriceInfo', 'getStockPriceInfo'];
  }
  if (assetType === 'STOCK') {
    return ['getStockPriceInfo', 'getSecuritiesPriceInfo'];
  }
  return ['getStockPriceInfo', 'getSecuritiesPriceInfo', 'getETFPriceInfo'];
}

function inferAssetType(operation: FscQuoteOperation): string {
  return operation === 'getETFPriceInfo' || operation === 'getSecuritiesPriceInfo'
    ? 'ETF'
    : 'STOCK';
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
    return this.supportsLookup(position);
  }

  supportsLookup(input: QuoteLookupInput): boolean {
    const code = normalizeShortCode(input.symbol);
    if (!code) return false;

    if (!input.market) return true;
    return KRX_MARKETS.has(input.market.toUpperCase());
  }

  async getQuoteBySymbol(
    symbol: string,
    lookup: Omit<QuoteLookupInput, 'symbol'> = {},
  ): Promise<PositionQuote | null> {
    const shortCode = normalizeShortCode(symbol);
    if (!shortCode || !this.isEnabled()) return null;
    return this.getQuote(shortCode, lookup);
  }

  private async getQuote(
    shortCode: string,
    lookup: Omit<QuoteLookupInput, 'symbol'> = {},
  ): Promise<PositionQuote | null> {
    const operations = getPreferredOperations(lookup);
    for (const operation of operations) {
      const quote = await this.fetchQuote(shortCode, operation);
      if (quote) return quote;
    }
    return null;
  }

  private async fetchQuote(shortCode: string, operation: FscQuoteOperation): Promise<PositionQuote | null> {
    const serviceKey = this.stockServiceKey;
    if (!serviceKey) return null;

    const cacheKey = getCacheKey(shortCode, operation);
    const cached = await getCachedQuote(this.db, cacheKey);
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
          : `FSC stock API request failed with ${response.status}`,
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
      await setCachedQuote(this.db, {
        cacheKey,
        lookupSymbol: shortCode,
        operation,
        quote: null,
      });
      return null;
    }

    const closePrice = toNumber(latest.clpr);
    const asOfDate = toIsoDate(latest.basDt);
    if (closePrice === null || !asOfDate) {
      await setCachedQuote(this.db, {
        cacheKey,
        lookupSymbol: shortCode,
        operation,
        quote: null,
      });
      return null;
    }

    const quote: PositionQuote = {
      shortCode,
      resolvedSymbol: shortCode,
      name: latest.itmsNm ?? null,
      marketCategory: latest.mrktCtg ?? null,
      closePrice,
      change: toNumber(latest.vs),
      changeRate: toNumber(latest.fltRt),
      asOfDate,
      operation,
      source: 'FSC_STOCK_PRICE_API',
      assetType: inferAssetType(operation),
    };

    await setCachedQuote(this.db, {
      cacheKey,
      lookupSymbol: shortCode,
      operation,
      quote,
    });

    return quote;
  }

  private getUnauthorizedMessage(operation: FscQuoteOperation): string {
    if (operation === 'getETFPriceInfo') {
      return 'FSC ETF API request failed with 401. Check whether FSC_STOCK_API_SERVICE_KEY is the decoded key from data.go.kr.';
    }
    return 'FSC stock API request failed with 401. Check whether FSC_STOCK_API_SERVICE_KEY is the decoded key from data.go.kr.';
  }
}
