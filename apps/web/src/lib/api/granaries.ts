import type {
  CreateGranary,
  Granary,
  GranaryWithLatestSnapshot,
  Position,
  Snapshot,
  UpdateGranary,
} from '@gokkan-keeper/shared';
import type { TechnicalIndicatorResult } from './market-data';
import { fetchPrivateApi } from './client';

export interface GranaryExportPayload {
  exportedAt: string;
  granary: Granary;
  latestSnapshot: Snapshot | null;
  positions: Position[];
  indicators: Record<string, { '1d': TechnicalIndicatorResult[]; '1wk': TechnicalIndicatorResult[] }>;
}

export interface AllGranariesExportPayload {
  exportedAt: string;
  granaries: Omit<GranaryExportPayload, 'exportedAt'>[];
}

export const getGranaries = () =>
  fetchPrivateApi<GranaryWithLatestSnapshot[]>('/granaries');
export const getGranary = (id: string) => fetchPrivateApi<GranaryWithLatestSnapshot>(`/granaries/${id}`);
export const getGranaryExport = (id: string) =>
  fetchPrivateApi<GranaryExportPayload>(`/granaries/${id}/export`);
export const getAllGranariesExport = () =>
  fetchPrivateApi<AllGranariesExportPayload>('/granaries/export');

export const createGranary = (data: CreateGranary) =>
  fetchPrivateApi<Granary>('/granaries', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateGranary = (id: string, data: UpdateGranary) =>
  fetchPrivateApi<Granary>(`/granaries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
