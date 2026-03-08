export type PositionPriceSource = 'FSC_STOCK_PRICE_API' | 'YAHOO_FINANCE';

export type PositionQuoteOperation =
  | 'getStockPriceInfo'
  | 'getSecuritiesPriceInfo'
  | 'getETFPriceInfo'
  | 'YAHOO_CHART';

export interface QuoteLookupInput {
  symbol: string;
  market?: string | null;
  assetType?: string | null;
}

export interface PositionQuote {
  shortCode: string;
  resolvedSymbol: string;
  name: string | null;
  marketCategory: string | null;
  closePrice: number;
  change: number | null;
  changeRate: number | null;
  asOfDate: string;
  operation: PositionQuoteOperation;
  source: PositionPriceSource;
  assetType: string | null;
}
