import { fetchPrivateApi } from './client';

export interface TechnicalIndicatorResult {
  symbol: string;
  asOfDate: string;
  rsi: number | null;
  macdOsc: number | null;
  obv: number | null;
  adx: number | null;
  diPlus: number | null;
  diMinus: number | null;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number | null;
  changeRate: number | null;
  asOfDate: string;
}

export interface MarketIndicesResponse {
  indices: MarketIndex[];
  fetchedAt: string;
}

export function getPositionIndicators(symbol: string, market?: string | null, interval: '1d' | '1wk' = '1d'): Promise<TechnicalIndicatorResult> {
  const params = new URLSearchParams({ symbol, interval });
  if (market) params.set('market', market);
  return fetchPrivateApi<TechnicalIndicatorResult>(`/positions/indicators?${params.toString()}`);
}
export const getMarketIndices = () => fetchPrivateApi<MarketIndicesResponse>('/market-indices');
