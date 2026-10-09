import { useEffect, useState } from 'react';
import { getGranaries, getPositions } from '../../lib/api';
import type { CreateSnapshot, GranaryWithLatestSnapshot, Position } from '../../lib/types';

import { useSnapshotCalculations } from './useSnapshotCalculations';
export function useNewSnapshot(granaryIdParam: string | null) {
  const [loadingGranaries, setLoadingGranaries] = useState(true);
  const [granaries, setGranaries] = useState<GranaryWithLatestSnapshot[]>([]);
  const [formData, setFormData] = useState<CreateSnapshot>({
    granaryId: granaryIdParam || '',
    date: new Date().toISOString().split('T')[0],
    totalAmount: 0,
    availableBalance: undefined,
    profitLoss: undefined,
    memo: '',
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [isTotalAmountManual, setIsTotalAmountManual] = useState(false);
  const [isProfitLossManual, setIsProfitLossManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyLatestSnapshotDefaults = (granaryId: string, granaryList: GranaryWithLatestSnapshot[]) => {
    const selectedGranary = granaryList.find((item) => item.id === granaryId);
    const latestSnapshot = selectedGranary?.latestSnapshot;

    setIsTotalAmountManual(false);
    setIsProfitLossManual(false);
    setFormData((prev) => ({
      ...prev,
      granaryId,
      totalAmount: latestSnapshot?.totalAmount ?? 0,
      availableBalance: latestSnapshot?.availableBalance ?? undefined,
      profitLoss: latestSnapshot?.profitLoss ?? undefined,
    }));
  };

  useEffect(() => {
    async function loadGranaries() {
      try {
        const data = await getGranaries();
        setGranaries(data);
        if (granaryIdParam && data.length > 0) {
          applyLatestSnapshotDefaults(granaryIdParam, data);
        }
      } catch (err: unknown) {
        setError((err instanceof Error && err.message) || '곳간 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoadingGranaries(false);
      }
    }
    void loadGranaries();
  }, [granaryIdParam]);

  useEffect(() => {
    if (!formData.granaryId) {
      setPositions([]);
      return;
    }
    getPositions(formData.granaryId).then(setPositions).catch(() => setPositions([]));
  }, [formData.granaryId]);

  useSnapshotCalculations(formData, setFormData, isTotalAmountManual, isProfitLossManual);
  return { loadingGranaries, granaries, formData, setFormData, positions, isTotalAmountManual, setIsTotalAmountManual, isProfitLossManual, setIsProfitLossManual, loading, setLoading, error, setError, applyLatestSnapshotDefaults };
}
export type NewSnapshotState = ReturnType<typeof useNewSnapshot>;
