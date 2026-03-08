import type { D1Database } from '@cloudflare/workers-types';
import { getCacheKey, getCachedQuote, setCachedQuote } from './quote-cache';
import type { PositionQuote, QuoteLookupInput } from './quote-types';

const DEFAULT_YAHOO_CHART_BASE_URL = 'https://query2.finance.yahoo.com/v8/finance/chart';
const KRX_MARKETS = new Set(['KRX', 'KOSDAQ', 'KOSPI', 'KONEX']);
const YAHOO_SUPPORTED_ASSET_TYPES = new Set(['STOCK', 'ETF']);
const YAHOO_SUFFIX_BY_MARKET: Record<string, string> = {
  TSE: '.T',
  HKEX: '.HK',
  SSE: '.SS',
  SZSE: '.SZ',
};
const YAHOO_REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; GokkanKeeper/1.0; +https://gokkan-keeper.yetimates.com)',
};

interface YahooChartMeta {
  instrumentType?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  longName?: string;
  shortName?: string;
  chartPreviousClose?: number;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
}

function normalizeMarket(market?: string | null): string | null {
  const normalized = market?.trim().toUpperCase();
  return normalized || null;
}

function isUsTicker(value: string): boolean {
  return /^[A-Z][A-Z0-9.\-=/^]{0,14}$/.test(value);
}

function normalizeExchangeName(meta?: YahooChartMeta): string | null {
  const exchangeName = String(meta?.exchangeName ?? '').toUpperCase();
  const fullExchangeName = String(meta?.fullExchangeName ?? '').toUpperCase();

  if (exchangeName === 'NMS' || fullExchangeName.includes('NASDAQ')) return 'NASDAQ';
  if (exchangeName === 'NYQ' || fullExchangeName.includes('NYSE')) return 'NYSE';
  if (exchangeName === 'ASE' || exchangeName === 'PCX' || fullExchangeName.includes('AMEX')) return 'AMEX';
  if (exchangeName === 'JPX' || fullExchangeName.includes('TOKYO')) return 'TSE';
  if (exchangeName === 'HKG' || fullExchangeName.includes('HONG KONG')) return 'HKEX';
  if (exchangeName === 'SHH' || fullExchangeName.includes('SHANGHAI')) return 'SSE';
  if (exchangeName === 'SHZ' || fullExchangeName.includes('SHENZHEN')) return 'SZSE';

  return meta?.fullExchangeName ?? meta?.exchangeName ?? null;
}

function inferAssetType(inputAssetType?: string | null, instrumentType?: string): string | null {
  if (inputAssetType?.trim()) {
    return inputAssetType.trim().toUpperCase();
  }

  const normalized = instrumentType?.trim().toUpperCase();
  if (normalized === 'ETF') return 'ETF';
  if (normalized === 'EQUITY') return 'STOCK';
  return null;
}

function toIsoDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

export function normalizeYahooSymbol(symbol: string, market?: string | null): string | null {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return null;

  if (normalizedSymbol.includes('.')) {
    return normalizedSymbol;
  }

  const normalizedMarket = normalizeMarket(market);
  if (!normalizedMarket) {
    return isUsTicker(normalizedSymbol) ? normalizedSymbol : null;
  }

  if (KRX_MARKETS.has(normalizedMarket)) {
    return null;
  }

  if (normalizedMarket === 'NASDAQ' || normalizedMarket === 'NYSE' || normalizedMarket === 'AMEX') {
    return isUsTicker(normalizedSymbol) ? normalizedSymbol : null;
  }

  const suffix = YAHOO_SUFFIX_BY_MARKET[normalizedMarket];
  if (!suffix) {
    return isUsTicker(normalizedSymbol) ? normalizedSymbol : null;
  }

  if (normalizedMarket === 'HKEX' && /^\d{1,5}$/.test(normalizedSymbol)) {
    return `${normalizedSymbol.padStart(4, '0')}${suffix}`;
  }

  if (/^\d{4,6}$/.test(normalizedSymbol)) {
    return `${normalizedSymbol}${suffix}`;
  }

  return null;
}

export class YahooFinanceQuoteService {
  private readonly chartBaseUrl: string;

  constructor(
    chartBaseUrl = DEFAULT_YAHOO_CHART_BASE_URL,
    private readonly db?: D1Database,
  ) {
    this.chartBaseUrl = chartBaseUrl;
  }

  supportsLookup(input: QuoteLookupInput): boolean {
    const assetType = input.assetType?.trim().toUpperCase();
    if (assetType && !YAHOO_SUPPORTED_ASSET_TYPES.has(assetType)) {
      return false;
    }

    const market = normalizeMarket(input.market);
    if (market && KRX_MARKETS.has(market)) {
      return false;
    }

    return !!normalizeYahooSymbol(input.symbol, input.market);
  }

  async getQuoteBySymbol(
    symbol: string,
    lookup: Omit<QuoteLookupInput, 'symbol'> = {},
  ): Promise<PositionQuote | null> {
    const resolvedSymbol = normalizeYahooSymbol(symbol, lookup.market);
    if (!resolvedSymbol) return null;

    const cacheKey = getCacheKey(resolvedSymbol, 'YAHOO_CHART');
    const cached = await getCachedQuote(this.db, cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const url = new URL(`${this.chartBaseUrl}/${encodeURIComponent(resolvedSymbol)}`);
    url.searchParams.set('interval', '1d');
    url.searchParams.set('range', '5d');
    url.searchParams.set('includePrePost', 'false');

    const response = await fetch(url.toString(), {
      headers: YAHOO_REQUEST_HEADERS,
    });
    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? 'Yahoo Finance quote request was rate limited. Try again shortly.'
          : `Yahoo Finance quote request failed with ${response.status}`,
      );
    }

    const payload = await response.json() as YahooChartResponse;
    if (payload.chart?.error) {
      throw new Error(payload.chart.error.description || 'Yahoo Finance chart API returned an error');
    }

    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];

    let latestIndex = -1;
    for (let index = closes.length - 1; index >= 0; index -= 1) {
      if (typeof closes[index] === 'number' && typeof timestamps[index] === 'number') {
        latestIndex = index;
        break;
      }
    }

    if (latestIndex === -1) {
      await setCachedQuote(this.db, {
        cacheKey,
        lookupSymbol: resolvedSymbol,
        operation: 'YAHOO_CHART',
        quote: null,
      });
      return null;
    }

    const closePrice = closes[latestIndex] as number;
    const previousClose = result?.meta?.chartPreviousClose ?? null;
    const change = previousClose !== null ? closePrice - previousClose : null;
    const changeRate = previousClose ? (change! / previousClose) * 100 : null;

    const quote: PositionQuote = {
      shortCode: resolvedSymbol,
      resolvedSymbol,
      name: result?.meta?.longName ?? result?.meta?.shortName ?? null,
      marketCategory: normalizeExchangeName(result?.meta),
      closePrice,
      change,
      changeRate,
      asOfDate: toIsoDate(timestamps[latestIndex] as number),
      operation: 'YAHOO_CHART',
      source: 'YAHOO_FINANCE',
      assetType: inferAssetType(lookup.assetType, result?.meta?.instrumentType),
    };

    await setCachedQuote(this.db, {
      cacheKey,
      lookupSymbol: resolvedSymbol,
      operation: 'YAHOO_CHART',
      quote,
    });

    return quote;
  }
}
