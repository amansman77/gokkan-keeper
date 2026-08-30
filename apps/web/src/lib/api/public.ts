import type { ConsultingRequestResult, PublicPortfolioEntry, PublicPortfolioWarning } from '@gokkan-keeper/shared';
import { fetchPublicApi } from './client';

export interface PublicPortfolioEntryData extends PublicPortfolioEntry {
  currentUnitPrice?: number | null;
  currentPriceAsOf?: string | null;
  currentPriceSource?: 'MANUAL' | 'FSC_STOCK_PRICE_API' | 'YAHOO_FINANCE' | null;
}

export interface PublicPortfolioResponseData {
  data: PublicPortfolioEntryData[];
  meta: {
    warnings: PublicPortfolioWarning[];
    pricing: {
      integratedCount: number;
      manualCount: number;
      latestAsOf: string | null;
    };
  };
}

export const getPublicPortfolio = () => fetchPublicApi<PublicPortfolioResponseData>('/public/portfolio');

export const submitConsultingRequest = (data: FormData) =>
  fetchPublicApi<ConsultingRequestResult>('/public/consulting-request', {
    method: 'POST',
    body: data,
  });
