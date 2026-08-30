import type { CreateSnapshot, Snapshot, StatusSummary, UpdateSnapshot } from '@gokkan-keeper/shared';
import { fetchPrivateApi } from './client';

export const getSnapshots = (granaryId?: string) =>
  fetchPrivateApi<Snapshot[]>(granaryId ? `/snapshots?granaryId=${granaryId}` : '/snapshots');
export const getSnapshot = (id: string) => fetchPrivateApi<Snapshot>(`/snapshots/${id}`);

export const createSnapshot = (data: CreateSnapshot) =>
  fetchPrivateApi<Snapshot>('/snapshots', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateSnapshot = (id: string, data: UpdateSnapshot) =>
  fetchPrivateApi<Snapshot>(`/snapshots/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const getStatus = () => fetchPrivateApi<StatusSummary>('/status');
