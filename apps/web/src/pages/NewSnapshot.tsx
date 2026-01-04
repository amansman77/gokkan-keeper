import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createSnapshot, getGranaries } from '../lib/api';
import type { CreateSnapshot, Granary } from '../lib/types';

export default function NewSnapshot() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const granaryIdParam = searchParams.get('granaryId');

  const [granaries, setGranaries] = useState<Granary[]>([]);
  const [formData, setFormData] = useState<CreateSnapshot>({
    granaryId: granaryIdParam || '',
    date: new Date().toISOString().split('T')[0],
    totalAmount: 0,
    availableBalance: undefined,
    memo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGranaries() {
      try {
        const data = await getGranaries();
        setGranaries(data);
        if (granaryIdParam && data.length > 0) {
          setFormData((prev) => ({ ...prev, granaryId: granaryIdParam }));
        }
      } catch (err: any) {
        setError(err.message || '곳간 목록을 불러오는데 실패했습니다.');
      }
    }
    loadGranaries();
  }, [granaryIdParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const snapshot = await createSnapshot(formData);
      navigate(`/granaries/${snapshot.granaryId}`);
    } catch (err: any) {
      setError(err.message || '스냅샷 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">새 스냅샷 추가</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label htmlFor="granaryId" className="block text-sm font-medium text-gray-700 mb-2">
            곳간
          </label>
          <select
            id="granaryId"
            required
            value={formData.granaryId}
            onChange={(e) => setFormData({ ...formData, granaryId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!!granaryIdParam}
          >
            <option value="">곳간을 선택하세요</option>
            {granaries.map((granary) => (
              <option key={granary.id} value={granary.id}>
                {granary.name} ({granary.purpose})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
            날짜
          </label>
          <input
            type="date"
            id="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-2">
            총 평가 금액
          </label>
          <input
            type="number"
            id="totalAmount"
            required
            min="0"
            step="0.01"
            value={formData.totalAmount || ''}
            onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="availableBalance" className="block text-sm font-medium text-gray-700 mb-2">
            예수금 (선택)
          </label>
          <input
            type="number"
            id="availableBalance"
            min="0"
            step="0.01"
            value={formData.availableBalance || ''}
            onChange={(e) => setFormData({ ...formData, availableBalance: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="memo" className="block text-sm font-medium text-gray-700 mb-2">
            메모 (선택)
          </label>
          <textarea
            id="memo"
            rows={3}
            value={formData.memo || ''}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="간단한 메모를 남기세요"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '생성 중...' : '추가하기'}
          </button>
        </div>
      </form>
    </div>
  );
}

