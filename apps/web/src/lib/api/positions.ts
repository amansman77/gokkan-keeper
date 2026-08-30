import type { CreatePosition, Position, UpdatePosition } from '@gokkan-keeper/shared';
import { fetchPrivateApi } from './client';

export interface PositionQuoteLookupResult {
  symbol: string;
  shortCode: string;
  name: string | null;
  market: string | null;
  assetType: string | null;
  currentValue: number;
  currentUnitPrice: number;
  currentPriceAsOf: string;
  currentPriceChange: number | null;
  currentPriceChangeRate: number | null;
  currentPriceSource: 'FSC_STOCK_PRICE_API' | 'YAHOO_FINANCE';
}

export const getPositions = (granaryId?: string) =>
  fetchPrivateApi<Position[]>(granaryId ? `/positions?granary_id=${granaryId}` : '/positions');
export const getPosition = (id: string) => fetchPrivateApi<Position>(`/positions/${id}`);

export function lookupPositionQuote(symbol: string, market?: string | null, assetType?: string | null): Promise<PositionQuoteLookupResult> {
  const params = new URLSearchParams({ symbol });
  if (market) params.set('market', market);
  if (assetType) params.set('assetType', assetType);
  return fetchPrivateApi<PositionQuoteLookupResult>(`/positions/quote?${params.toString()}`);
}

export const createPosition = (data: CreatePosition) =>
  fetchPrivateApi<Position>('/positions', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updatePosition = (id: string, data: UpdatePosition) =>
  fetchPrivateApi<Position>(`/positions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deletePosition = (id: string) =>
  fetchPrivateApi<{ ok: boolean }>(`/positions/${id}`, { method: 'DELETE' });
