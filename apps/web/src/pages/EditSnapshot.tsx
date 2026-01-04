import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSnapshot, updateSnapshot, getGranaries } from '../lib/api';
import type { Snapshot, UpdateSnapshot, Granary } from '../lib/types';

export default function EditSnapshot() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
      } catch (err: any) {
        setError(err.message || '스냅샷을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await updateSnapshot(id, formData);
      navigate(`/granaries/${updated.granaryId}`);
    } catch (err: any) {
      setError(err.message || '스냅샷 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error || '스냅샷을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const granary = granaries.find((g) => g.id === snapshot.granaryId);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <button
          onClick={() => navigate(`/granaries/${snapshot.granaryId}`)}
          className="text-blue-600 hover:underline"
        >
          ← 돌아가기
        </button>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">스냅샷 수정</h1>

      {granary && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">곳간</p>
          <p className="font-medium">{granary.name} ({granary.purpose})</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
            날짜
          </label>
          <input
            type="date"
            id="date"
            required
            value={formData.date || ''}
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
            value={formData.availableBalance ?? ''}
            onChange={(e) => setFormData({ ...formData, availableBalance: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setFormData({ ...formData, availableBalance: null })}
            className="mt-2 text-sm text-gray-600 hover:text-gray-900"
          >
            예수금 제거
          </button>
        </div>

        <div>
          <label htmlFor="profitLoss" className="block text-sm font-medium text-gray-700 mb-2">
            평가 손익 (선택)
          </label>
          <input
            type="number"
            id="profitLoss"
            step="0.01"
            value={formData.profitLoss ?? ''}
            onChange={(e) => setFormData({ ...formData, profitLoss: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="양수: 수익, 음수: 손실"
          />
          <button
            type="button"
            onClick={() => setFormData({ ...formData, profitLoss: null })}
            className="mt-2 text-sm text-gray-600 hover:text-gray-900"
          >
            평가 손익 제거
          </button>
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
          <button
            type="button"
            onClick={() => setFormData({ ...formData, memo: null })}
            className="mt-2 text-sm text-gray-600 hover:text-gray-900"
          >
            메모 제거
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(`/granaries/${snapshot.granaryId}`)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  );
}

