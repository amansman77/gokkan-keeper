import type {
  CreateJudgmentDiaryEntry,
  JudgmentDiaryEntry,
  JudgmentDiaryListFilters,
  UpdateJudgmentDiaryEntry,
} from '@gokkan-keeper/shared';
import { fetchPrivateApi } from './client';

export function getJudgmentDiaryEntries(filters: JudgmentDiaryListFilters = {}): Promise<JudgmentDiaryEntry[]> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.action) params.set('action', filters.action);
  if (filters.asset) params.set('asset', filters.asset);
  if (filters.strategyTag) params.set('strategyTag', filters.strategyTag);
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString();
  return fetchPrivateApi<JudgmentDiaryEntry[]>(query ? `/judgment-diary?${query}` : '/judgment-diary');
}
export const getJudgmentDiaryEntry = (id: string) => fetchPrivateApi<JudgmentDiaryEntry>(`/judgment-diary/${id}`);

export const createJudgmentDiaryEntry = (data: CreateJudgmentDiaryEntry) =>
  fetchPrivateApi<JudgmentDiaryEntry>('/judgment-diary', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateJudgmentDiaryEntry = (id: string, data: UpdateJudgmentDiaryEntry) =>
  fetchPrivateApi<JudgmentDiaryEntry>(`/judgment-diary/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
