import type { AlertThreshold, CreateAlertThreshold, UpdateAlertThreshold } from '@gokkan-keeper/shared';
import { fetchPrivateApi } from './client';

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

export const getAlerts = (limit = 50) => fetchPrivateApi<AlertLogEntry[]>(`/alerts?limit=${limit}`);

export const getAlertThresholds = () => fetchPrivateApi<AlertThreshold[]>('/alert-thresholds');

export const createAlertThreshold = (data: CreateAlertThreshold) =>
  fetchPrivateApi<AlertThreshold>('/alert-thresholds', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateAlertThreshold = (id: string, data: UpdateAlertThreshold) =>
  fetchPrivateApi<AlertThreshold>(`/alert-thresholds/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteAlertThreshold = (id: string) =>
  fetchPrivateApi<void>(`/alert-thresholds/${id}`, { method: 'DELETE' });
