import type { CashFlow, CreateCashFlow, UpdateCashFlow } from '@gokkan-keeper/shared';
import { fetchPrivateApi } from './client';

export const getCashFlows = (granaryId: string) =>
  fetchPrivateApi<CashFlow[]>(`/cash-flows?granaryId=${granaryId}`);

export const createCashFlow = (data: CreateCashFlow) =>
  fetchPrivateApi<CashFlow>('/cash-flows', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateCashFlow = (id: string, data: UpdateCashFlow) =>
  fetchPrivateApi<CashFlow>(`/cash-flows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteCashFlow = (id: string) =>
  fetchPrivateApi<void>(`/cash-flows/${id}`, { method: 'DELETE' });
