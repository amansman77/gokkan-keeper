import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PositionForm from '../components/PositionForm';
import { getGranaries, getPosition, updatePosition } from '../lib/api';
import type { CreatePosition, Granary, Position } from '../lib/types';

export default function EditPosition() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [granaries, setGranaries] = useState<Granary[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        setError('포지션 ID가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        const [positionData, granariesData] = await Promise.all([
          getPosition(id),
          getGranaries(),
        ]);
        setPosition(positionData);
        setGranaries(granariesData);
      } catch (err: any) {
        setError(err.message || '포지션을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error || !position) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error || '포지션을 찾을 수 없습니다.'}</p>
      </div>
    );
  }

  const initialData: CreatePosition = {
    granaryId: position.granaryId ?? null,
    name: position.name,
    symbol: position.symbol,
    market: position.market ?? null,
    assetType: position.assetType ?? null,
    quantity: position.quantity ?? null,
    avgCost: position.avgCost ?? null,
    currentValue: position.currentValue ?? null,
    weightPercent: position.weightPercent ?? null,
    profitLoss: position.profitLoss ?? null,
    profitLossPercent: position.profitLossPercent ?? null,
    note: position.note ?? null,
    isPublic: position.isPublic,
    publicThesis: position.publicThesis ?? null,
    publicOrder: position.publicOrder ?? 0,
  };

  const handleSubmit = async (data: CreatePosition) => {
    if (!id) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await updatePosition(id, data);
      navigate(updated.granaryId ? `/granaries/${updated.granaryId}` : '/');
    } catch (err: any) {
      setError(err.message || '포지션 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">포지션 수정</h1>
      <PositionForm
        granaries={granaries}
        initialData={initialData}
        loading={saving}
        error={error}
        submitLabel="저장하기"
        onSubmit={handleSubmit}
        onCancel={() => navigate(position.granaryId ? `/granaries/${position.granaryId}` : '/')}
      />
    </div>
  );
}
