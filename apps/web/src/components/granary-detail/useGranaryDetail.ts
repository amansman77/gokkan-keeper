import { useCallback, useEffect, useState } from 'react';
import { getCashFlows, getGranary, getPositions, getSnapshots } from '../../lib/api';
import type { CashFlow, GranaryWithLatestSnapshot, Position, Snapshot } from '../../lib/types';

export function useGranaryDetail(id: string | undefined) {
  const [granary, setGranary] = useState<GranaryWithLatestSnapshot | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) {
      setError('곳간 ID가 없습니다.');
      setLoading(false);
      return;
    }

    const granaryId = id; // Type narrowing

    async function loadData() {
      try {
        setLoading(true);
        const [granaryData, snapshotsData, positionsData, cashFlowsData] = await Promise.all([
          getGranary(granaryId),
          getSnapshots(granaryId),
          getPositions(granaryId),
          getCashFlows(granaryId),
        ]);
        setGranary(granaryData);
        setSnapshots(snapshotsData);
        setPositions(positionsData);
        setCashFlows(cashFlowsData);
      } catch (err: unknown) {
        setError((err instanceof Error && err.message) || '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [id]);

  const reloadCashFlows = useCallback(async () => {
    if (!id) return;
    setCashFlows(await getCashFlows(id));
  }, [id]);

  return { granary, snapshots, positions, cashFlows, loading, error, setPositions, reloadCashFlows };
}
