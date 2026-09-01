import { API_BASE_URL } from './config';
import type {
  Granary,
  Snapshot,
  CreateGranary,
  CreateSnapshot,
  UpdateGranary,
  UpdateSnapshot,
  StatusSummary,
  GranaryWithLatestSnapshot,
  JudgmentDiaryEntry,
  CreateJudgmentDiaryEntry,
  UpdateJudgmentDiaryEntry,
  JudgmentDiaryListFilters,
  PublicPortfolioEntry,
  PublicPortfolioWarning,
  ConsultingRequestResult,
  Position,
  CreatePosition,
  UpdatePosition,
  AlertThreshold,
  CreateAlertThreshold,
  UpdateAlertThreshold,
  CashFlow,
  CreateCashFlow,
  UpdateCashFlow,
} from '@gokkan-keeper/shared';

interface AuthUser {
  email: string;
  sub?: string;
}

interface AuthMeResponse {
  authenticated: boolean;
  user?: AuthUser;
}

interface GoogleLoginResponse {
  ok: boolean;
  next: string;
  user: AuthUser;
}

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

interface FetchJsonOptions {
  withCredentials?: boolean;
  networkErrorMessage?: string;
}

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {},
  config: FetchJsonOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const response = await fetch(url, {
      ...(config.withCredentials ? { credentials: 'include' as const } : {}),
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    if (config.networkErrorMessage && error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(config.networkErrorMessage);
    }
    throw error;
  }
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return fetchJson<T>(endpoint, options, {
    withCredentials: true,
    networkErrorMessage: `API 서버에 연결할 수 없습니다. ${API_BASE_URL}가 실행 중인지 확인하세요.`,
  });
}

async function fetchPublicAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return fetchJson<T>(endpoint, options);
}

async function fetchAuthAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return fetchJson<T>(endpoint, options, {
    withCredentials: true,
  });
}

export async function getGranaries(): Promise<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]> {
  return fetchAPI<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]>('/granaries');
}

export async function getGranary(id: string): Promise<GranaryWithLatestSnapshot> {
  return fetchAPI<GranaryWithLatestSnapshot>(`/granaries/${id}`);
}

export interface GranaryExportPayload {
  exportedAt: string;
  granary: Granary;
  latestSnapshot: Snapshot | null;
  positions: Position[];
  indicators: Record<string, { '1d': TechnicalIndicatorResult[]; '1wk': TechnicalIndicatorResult[] }>;
}

export async function getGranaryExport(id: string): Promise<GranaryExportPayload> {
  return fetchAPI<GranaryExportPayload>(`/granaries/${id}/export`);
}

export interface AllGranariesExportPayload {
  exportedAt: string;
  granaries: Omit<GranaryExportPayload, 'exportedAt'>[];
}

export async function getAllGranariesExport(): Promise<AllGranariesExportPayload> {
  return fetchAPI<AllGranariesExportPayload>('/granaries/export');
}

export async function createGranary(data: CreateGranary): Promise<Granary> {
  return fetchAPI<Granary>('/granaries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGranary(id: string, data: UpdateGranary): Promise<Granary> {
  return fetchAPI<Granary>(`/granaries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getSnapshots(granaryId?: string): Promise<Snapshot[]> {
  const endpoint = granaryId ? `/snapshots?granaryId=${granaryId}` : '/snapshots';
  return fetchAPI<Snapshot[]>(endpoint);
}

export async function getSnapshot(id: string): Promise<Snapshot> {
  return fetchAPI<Snapshot>(`/snapshots/${id}`);
}

export async function createSnapshot(data: CreateSnapshot): Promise<Snapshot> {
  return fetchAPI<Snapshot>('/snapshots', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSnapshot(id: string, data: UpdateSnapshot): Promise<Snapshot> {
  return fetchAPI<Snapshot>(`/snapshots/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getStatus(): Promise<StatusSummary> {
  return fetchAPI<StatusSummary>('/status');
}

export async function getJudgmentDiaryEntries(filters: JudgmentDiaryListFilters = {}): Promise<JudgmentDiaryEntry[]> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.action) params.set('action', filters.action);
  if (filters.asset) params.set('asset', filters.asset);
  if (filters.strategyTag) params.set('strategyTag', filters.strategyTag);
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString();
  const endpoint = query ? `/judgment-diary?${query}` : '/judgment-diary';
  return fetchAPI<JudgmentDiaryEntry[]>(endpoint);
}

export async function getJudgmentDiaryEntry(id: string): Promise<JudgmentDiaryEntry> {
  return fetchAPI<JudgmentDiaryEntry>(`/judgment-diary/${id}`);
}

export async function createJudgmentDiaryEntry(data: CreateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
  return fetchAPI<JudgmentDiaryEntry>('/judgment-diary', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateJudgmentDiaryEntry(id: string, data: UpdateJudgmentDiaryEntry): Promise<JudgmentDiaryEntry> {
  return fetchAPI<JudgmentDiaryEntry>(`/judgment-diary/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getPublicPortfolio(): Promise<PublicPortfolioResponseData> {
  return fetchPublicAPI<PublicPortfolioResponseData>('/public/portfolio');
}

export async function submitConsultingRequest(data: FormData): Promise<ConsultingRequestResult> {
  return fetchPublicAPI<ConsultingRequestResult>('/public/consulting-request', {
    method: 'POST',
    body: data,
  });
}

export async function getPositions(granaryId?: string): Promise<Position[]> {
  const endpoint = granaryId ? `/positions?granary_id=${granaryId}` : '/positions';
  return fetchAPI<Position[]>(endpoint);
}

export async function getPosition(id: string): Promise<Position> {
  return fetchAPI<Position>(`/positions/${id}`);
}

export async function lookupPositionQuote(
  symbol: string,
  market?: string | null,
  assetType?: string | null,
): Promise<PositionQuoteLookupResult> {
  const params = new URLSearchParams({ symbol });
  if (market) params.set('market', market);
  if (assetType) params.set('assetType', assetType);
  return fetchAPI<PositionQuoteLookupResult>(`/positions/quote?${params.toString()}`);
}

export async function createPosition(data: CreatePosition): Promise<Position> {
  return fetchAPI<Position>('/positions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePosition(id: string, data: UpdatePosition): Promise<Position> {
  return fetchAPI<Position>(`/positions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deletePosition(id: string): Promise<{ ok: boolean }> {
  return fetchAPI<{ ok: boolean }>(`/positions/${id}`, {
    method: 'DELETE',
  });
}

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

export async function getPositionIndicators(
  symbol: string,
  market?: string | null,
  interval: '1d' | '1wk' = '1d',
): Promise<TechnicalIndicatorResult> {
  const params = new URLSearchParams({ symbol, interval });
  if (market) params.set('market', market);
  return fetchAPI<TechnicalIndicatorResult>(`/positions/indicators?${params.toString()}`);
}

export interface WeeklyPoint {
  date: string;
  value: number;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number | null;
  changeRate: number | null;
  asOfDate: string;
  weeklySeries: WeeklyPoint[];
}

export interface MarketIndicesResponse {
  indices: MarketIndex[];
  fetchedAt: string;
}

export async function getMarketIndices(): Promise<MarketIndicesResponse> {
  return fetchAPI<MarketIndicesResponse>('/market-indices');
}

export interface AlertLogEntry {
  id: number;
  symbol: string;
  ruleId: string;
  date: string;
  priority: string;
  status: string;
  action: string | null;
  indicators: Record<string, unknown> | null;
  sentAt: string;
}

export async function getAlerts(limit = 50): Promise<AlertLogEntry[]> {
  return fetchAPI<AlertLogEntry[]>(`/alerts?limit=${limit}`);
}

export async function getAlertThresholds(): Promise<AlertThreshold[]> {
  return fetchAPI<AlertThreshold[]>('/alert-thresholds');
}

export async function createAlertThreshold(data: CreateAlertThreshold): Promise<AlertThreshold> {
  return fetchAPI<AlertThreshold>('/alert-thresholds', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAlertThreshold(id: string, data: UpdateAlertThreshold): Promise<AlertThreshold> {
  return fetchAPI<AlertThreshold>(`/alert-thresholds/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAlertThreshold(id: string): Promise<void> {
  await fetchAPI(`/alert-thresholds/${id}`, { method: 'DELETE' });
}

export async function getCashFlows(granaryId: string): Promise<CashFlow[]> {
  return fetchAPI<CashFlow[]>(`/cash-flows?granaryId=${granaryId}`);
}

export async function createCashFlow(data: CreateCashFlow): Promise<CashFlow> {
  return fetchAPI<CashFlow>('/cash-flows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCashFlow(id: string, data: UpdateCashFlow): Promise<CashFlow> {
  return fetchAPI<CashFlow>(`/cash-flows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCashFlow(id: string): Promise<void> {
  await fetchAPI(`/cash-flows/${id}`, { method: 'DELETE' });
}

export async function getSettings(): Promise<Record<string, string>> {
  return fetchAPI<Record<string, string>>('/settings');
}

export async function updateSetting(key: string, value: string): Promise<Record<string, string>> {
  return fetchAPI<Record<string, string>>(`/settings/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

export async function loginWithGoogle(credential: string, next?: string): Promise<GoogleLoginResponse> {
  return fetchAuthAPI<GoogleLoginResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential, next }),
  });
}

export async function getAuthMe(): Promise<AuthMeResponse> {
  return fetchAuthAPI<AuthMeResponse>('/auth/me', {
    method: 'GET',
  });
}

export async function logoutAuth(): Promise<{ ok: boolean }> {
  return fetchAuthAPI<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
  });
}
