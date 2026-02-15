import { API_BASE_URL, API_SECRET } from './config';
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
} from '@gokkan-keeper/shared';

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Secret': API_SECRET,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    // Network error or other fetch errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`API 서버에 연결할 수 없습니다. ${API_BASE_URL}가 실행 중인지 확인하세요.`);
    }
    throw error;
  }
}

export async function getGranaries(): Promise<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]> {
  return fetchAPI<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]>('/granaries');
}

export async function getGranary(id: string): Promise<GranaryWithLatestSnapshot> {
  return fetchAPI<GranaryWithLatestSnapshot>(`/granaries/${id}`);
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
