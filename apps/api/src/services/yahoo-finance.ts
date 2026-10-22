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

  const exchanges = [
    { market: 'NASDAQ', codes: ['NMS'], label: 'NASDAQ' },
    { market: 'NYSE', codes: ['NYQ'], label: 'NYSE' },
    { market: 'AMEX', codes: ['ASE', 'PCX'], label: 'AMEX' },
    { market: 'TSE', codes: ['JPX'], label: 'TOKYO' },
    { market: 'HKEX', codes: ['HKG'], label: 'HONG KONG' },
    { market: 'SSE', codes: ['SHH'], label: 'SHANGHAI' },
    { market: 'SZSE', codes: ['SHZ'], label: 'SHENZHEN' },
  ];
  const exchange = exchanges.find(({ codes, label }) => codes.includes(exchangeName) || fullExchangeName.includes(label));
  if (exchange) return exchange.market;

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

async function requestYahooChart(chartBaseUrl: string, resolvedSymbol: string): Promise<YahooChartResponse> {
  const url = new URL(`${chartBaseUrl}/${encodeURIComponent(resolvedSymbol)}`);
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

  return await response.json() as YahooChartResponse;
}

type YahooChartResult = NonNullable<NonNullable<YahooChartResponse['chart']>['result']>[number];
function latestYahooCloseIndex(result: YahooChartResult): number {
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  let latestIndex = -1;
  for (let index = closes.length - 1;index >= 0;index -= 1) {
    if (typeof closes[index] === 'number' && typeof timestamps[index] === 'number') {
      latestIndex = index;
      break;
    }
  }

  return latestIndex;
}

function yahooQuoteMetadata(meta: YahooChartMeta | undefined, assetType: string | null | undefined) {
  return {
    name: meta?.longName ?? meta?.shortName ?? null,
    marketCategory: normalizeExchangeName(meta),
    assetType: inferAssetType(assetType, meta?.instrumentType),
  };
}

function normalizeYahooQuote(payload: YahooChartResponse, resolvedSymbol: string, lookup: Omit<QuoteLookupInput, 'symbol'>): PositionQuote | null {
  if (payload.chart?.error) {
    throw new Error(payload.chart.error.description || 'Yahoo Finance chart API returned an error');
  }

  const result = payload.chart?.result?.[0];
  if (!result) return null;
  const latestIndex = latestYahooCloseIndex(result);
  if (latestIndex === -1) return null;
  const closes = result.indicators!.quote![0].close!;
  const timestamps = result.timestamp!;
  const closePrice = closes[latestIndex] as number;
  const previousClose = result?.meta?.chartPreviousClose ?? null;
  const change = previousClose !== null ? closePrice - previousClose : null;
  const changeRate = previousClose ? (change! / previousClose) * 100 : null;

  return {
    shortCode: resolvedSymbol,
    resolvedSymbol,
    ...yahooQuoteMetadata(result.meta, lookup.assetType),
    closePrice,
    change,
    changeRate,
    asOfDate: toIsoDate(timestamps[latestIndex] as number),
    operation: 'YAHOO_CHART',
    source: 'YAHOO_FINANCE',

  };
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

    const payload = await requestYahooChart(this.chartBaseUrl, resolvedSymbol);
    const quote = normalizeYahooQuote(payload, resolvedSymbol, lookup);
    await setCachedQuote(this.db, { cacheKey, lookupSymbol: resolvedSymbol, operation: 'YAHOO_CHART', quote });
    return quote;
  }
}
