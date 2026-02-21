import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PositionForm from '../components/PositionForm';
import { createPosition, getGranaries } from '../lib/api';
import type { CreatePosition, Granary } from '../lib/types';

export default function NewPosition() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const granaryIdParam = searchParams.get('granaryId');

  const [granaries, setGranaries] = useState<Granary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGranaries() {
      try {
        const data = await getGranaries();
        setGranaries(data);
      } catch (err: any) {
        setError(err.message || '곳간 목록을 불러오지 못했습니다.');
      }
    }
    loadGranaries();
  }, []);

  const initialData: CreatePosition = {
    granaryId: granaryIdParam || null,
    name: '',
    symbol: '',
    market: null,
    assetType: null,
    quantity: null,
    avgCost: null,
    currentValue: null,
    weightPercent: null,
    profitLoss: null,
    profitLossPercent: null,
    note: null,
    isPublic: false,
    publicThesis: null,
    publicOrder: 0,
  };

  const handleSubmit = async (data: CreatePosition) => {
    setLoading(true);
    setError(null);
    try {
      const created = await createPosition(data);
      navigate(created.granaryId ? `/granaries/${created.granaryId}` : '/');
    } catch (err: any) {
      setError(err.message || '포지션 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">새 포지션 추가</h1>
      <PositionForm
        granaries={granaries}
        initialData={initialData}
        loading={loading}
        error={error}
        submitLabel="추가하기"
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}
