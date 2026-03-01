import type { Position } from '@gokkan-keeper/shared';
import type { Env } from '../types';

const DEFAULT_BASE_URL = 'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService';
const KRX_MARKETS = new Set(['KRX', 'KOSDAQ', 'KOSPI', 'KONEX']);

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

function getBeginBaseDate(daysBack = 14): string {
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

export class FscStockPriceService {
  private readonly baseUrl: string;

  constructor(private readonly serviceKey?: string, baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  isEnabled(): boolean {
    return !!this.serviceKey;
  }

  supports(position: Position): boolean {
    const code = normalizeShortCode(position.symbol);
    if (!code) return false;

    if (!position.market) return true;
    return KRX_MARKETS.has(position.market.toUpperCase());
  }

  async getQuotesForPositions(positions: Position[]): Promise<Map<string, PositionQuote>> {
    if (!this.isEnabled()) return new Map();

    const shortCodes = Array.from(
      new Set(
        positions
          .filter((position) => this.supports(position))
          .map((position) => normalizeShortCode(position.symbol))
          .filter((value): value is string => !!value)
      )
    );

    const entries = await Promise.all(
      shortCodes.map(async (shortCode) => [shortCode, await this.getQuote(shortCode)] as const)
    );

    return new Map(entries.filter((entry): entry is readonly [string, PositionQuote] => !!entry[1]));
  }

  async getQuoteBySymbol(symbol: string): Promise<PositionQuote | null> {
    const shortCode = normalizeShortCode(symbol);
    if (!shortCode || !this.isEnabled()) return null;
    return this.getQuote(shortCode);
  }

  private async getQuote(shortCode: string): Promise<PositionQuote | null> {
    if (!this.serviceKey) return null;

    const url = new URL(`${this.baseUrl}/getStockPriceInfo`);
    url.searchParams.set('serviceKey', normalizeServiceKey(this.serviceKey));
    url.searchParams.set('numOfRows', '20');
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('resultType', 'json');
    url.searchParams.set('likeSrtnCd', shortCode);
    url.searchParams.set('beginBasDt', getBeginBaseDate());

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? 'FSC stock API request failed with 401. Check whether FSC_STOCK_API_SERVICE_KEY is the decoded key from data.go.kr.'
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
    const matchedItems = items
      .filter((item) => item.srtnCd === shortCode)
      .map((item) => ({
        item,
        isoDate: toIsoDate(item.basDt),
      }))
      .filter((entry): entry is { item: QuoteItem; isoDate: string } => !!entry.isoDate)
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));

    const latest = matchedItems[0]?.item;
    if (!latest) return null;

    const closePrice = toNumber(latest.clpr);
    const asOfDate = toIsoDate(latest.basDt);
    if (closePrice === null || !asOfDate) return null;

    return {
      shortCode,
      name: latest.itmsNm ?? null,
      marketCategory: latest.mrktCtg ?? null,
      closePrice,
      change: toNumber(latest.vs),
      changeRate: toNumber(latest.fltRt),
      asOfDate,
    };
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
