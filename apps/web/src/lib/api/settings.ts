import { fetchPrivateApi } from './client';

export const getSettings = () => fetchPrivateApi<Record<string, string>>('/settings');

export const updateSetting = (key: string, value: string) =>
  fetchPrivateApi<Record<string, string>>(`/settings/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
