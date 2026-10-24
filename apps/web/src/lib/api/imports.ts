import type { ApplyImport, ImportJob } from '@gokkan-keeper/shared';
import { fetchPrivateApi } from './client';

/** Screenshot import (docs/SCREENSHOT_IMPORT.md): owner-side requests. */
export const createImport = (granaryId: string) =>
  fetchPrivateApi<ImportJob>('/imports', { method: 'POST', body: JSON.stringify({ granaryId }) });

export const uploadImportImage = (id: string, seq: number, image: { mime: string; data: string }) =>
  fetchPrivateApi<void>(`/imports/${id}/images/${seq}`, { method: 'PUT', body: JSON.stringify(image) });

export const submitImport = (id: string) =>
  fetchPrivateApi<ImportJob>(`/imports/${id}/submit`, { method: 'POST', body: '{}' });

export const getImport = (id: string) => fetchPrivateApi<ImportJob>(`/imports/${id}`);

export const applyImport = (id: string, options: ApplyImport) =>
  fetchPrivateApi<ImportJob>(`/imports/${id}/apply`, { method: 'POST', body: JSON.stringify(options) });

export const discardImport = (id: string) =>
  fetchPrivateApi<ImportJob>(`/imports/${id}/discard`, { method: 'POST', body: '{}' });
