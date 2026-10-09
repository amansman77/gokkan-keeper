import { useEffect, useState } from 'react';
import { getGranaries, getSnapshot } from '../../lib/api';
import type { Granary, Snapshot, UpdateSnapshot } from '../../lib/types';

export function useEditSnapshot(id: string | undefined) {
  const [granaries, setGranaries] = useState<Granary[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [formData, setFormData] = useState<UpdateSnapshot>({
    date: '',
    totalAmount: 0,
    availableBalance: undefined,
    profitLoss: undefined,
    memo: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        setError('스냅샷 ID가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [snapshotData, granariesData] = await Promise.all([
          getSnapshot(id),
          getGranaries(),
        ]);
        setSnapshot(snapshotData);
        setFormData({
          date: snapshotData.date,
          totalAmount: snapshotData.totalAmount,
          availableBalance: snapshotData.availableBalance,
          profitLoss: snapshotData.profitLoss,
          memo: snapshotData.memo || '',
        });
        setGranaries(granariesData);
      } catch (err: unknown) {
        setError((err instanceof Error && err.message) || '스냅샷을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [id]);

  return { granaries, snapshot, formData, setFormData, loading, saving, setSaving, error, setError };
}
