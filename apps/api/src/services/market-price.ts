import type { Position } from '@gokkan-keeper/shared';
import type { Env } from '../types';
import { FscStockPriceService } from './fsc-stock-price';
import type { PositionQuote, QuoteLookupInput } from './quote-types';
import { YahooFinanceQuoteService } from './yahoo-finance';

export class MarketQuoteService {
  private readonly fscService: FscStockPriceService;
  private readonly yahooService: YahooFinanceQuoteService;

  constructor(env: Env) {
    this.fscService = new FscStockPriceService(
      env.FSC_STOCK_API_SERVICE_KEY,
      env.FSC_STOCK_API_BASE_URL,
      env.DB,
      env.FSC_SECURITIES_PRODUCT_API_BASE_URL,
    );
    this.yahooService = new YahooFinanceQuoteService(
      env.YAHOO_FINANCE_API_BASE_URL,
      env.DB,
    );
  }

  hasAvailableProvider(input: QuoteLookupInput): boolean {
    return (
      (this.fscService.isEnabled() && this.fscService.supportsLookup(input))
      || this.yahooService.supportsLookup(input)
    );
  }

  getUnavailableReason(input: QuoteLookupInput): string | null {
    if (this.fscService.supportsLookup(input) && !this.fscService.isEnabled()) {
      return 'FSC_STOCK_API_SERVICE_KEY is not configured';
    }
    if (!this.hasAvailableProvider(input)) {
      return 'Automatic quote lookup is not supported for this symbol/market yet';
    }
    return null;
  }

  async getQuoteBySymbol(
    symbol: string,
    lookup: Omit<QuoteLookupInput, 'symbol'> = {},
  ): Promise<PositionQuote | null> {
    const input: QuoteLookupInput = { symbol, ...lookup };

    if (this.fscService.isEnabled() && this.fscService.supportsLookup(input)) {
      const fscQuote = await this.fscService.getQuoteBySymbol(symbol, lookup);
      if (fscQuote) return fscQuote;
    }

    if (this.yahooService.supportsLookup(input)) {
      const yahooQuote = await this.yahooService.getQuoteBySymbol(symbol, lookup);
      if (yahooQuote) return yahooQuote;
    }

    return null;
  }
}

export function inferQuotedAssetType(
  inputAssetType: string | null,
  quote?: PositionQuote | null,
): string {
  if (inputAssetType && inputAssetType.trim()) {
    return inputAssetType.trim().toUpperCase();
  }

  if (quote?.assetType && quote.assetType.trim()) {
    return quote.assetType.trim().toUpperCase();
  }

  return quote?.operation === 'getETFPriceInfo' || quote?.operation === 'getSecuritiesPriceInfo'
    ? 'ETF'
    : 'STOCK';
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
    currentPriceSource: quote.source,
  };
}

export async function enrichPositionsWithLiveQuotes(positions: Position[], env: Env): Promise<Position[]> {
  const quoteService = new MarketQuoteService(env);

  try {
    const entries = await Promise.all(
      positions.map(async (position) => (
        [
          position.id,
          await quoteService.getQuoteBySymbol(position.symbol, {
            market: position.market ?? null,
            assetType: position.assetType ?? null,
          }),
        ] as const
      )),
    );

    const quoteMap = new Map(
      entries.filter((entry): entry is readonly [string, PositionQuote] => !!entry[1]),
    );

    return positions.map((position) => enrichPositionWithQuote(position, quoteMap.get(position.id) ?? null));
  } catch (error) {
    console.error('Failed to fetch live quotes', error);
    return positions.map((position) => enrichPositionWithQuote(position, null));
  }
}
