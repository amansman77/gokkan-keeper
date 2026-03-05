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
  ConsultingRequest,
  ConsultingRequestResult,
  Position,
  CreatePosition,
  UpdatePosition,
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
  currentPriceSource: 'FSC_STOCK_PRICE_API';
}

export interface PublicPortfolioEntryData extends PublicPortfolioEntry {
  currentUnitPrice?: number | null;
  currentPriceAsOf?: string | null;
  currentPriceSource?: 'MANUAL' | 'FSC_STOCK_PRICE_API' | null;
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
    const response = await fetch(url, {
      ...(config.withCredentials ? { credentials: 'include' as const } : {}),
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
}

export async function getGranaryExport(id: string): Promise<GranaryExportPayload> {
  return fetchAPI<GranaryExportPayload>(`/granaries/${id}/export`);
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

export async function submitConsultingRequest(data: ConsultingRequest): Promise<ConsultingRequestResult> {
  return fetchPublicAPI<ConsultingRequestResult>('/public/consulting-request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPositions(granaryId?: string): Promise<Position[]> {
  const endpoint = granaryId ? `/positions?granary_id=${granaryId}` : '/positions';
  return fetchAPI<Position[]>(endpoint);
}

export async function getPosition(id: string): Promise<Position> {
  return fetchAPI<Position>(`/positions/${id}`);
}

export async function lookupPositionQuote(symbol: string, assetType?: string | null): Promise<PositionQuoteLookupResult> {
  const params = new URLSearchParams({ symbol });
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
