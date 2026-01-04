import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGranary, updateGranary } from '../lib/api';
import type { GranaryWithLatestSnapshot, UpdateGranary } from '../lib/types';
import { GRANARY_PURPOSES, CURRENCIES } from '@gokkan-keeper/shared';

export default function EditGranary() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [granary, setGranary] = useState<GranaryWithLatestSnapshot | null>(null);
  const [formData, setFormData] = useState<UpdateGranary>({
    name: '',
    purpose: '비상금',
    currency: 'KRW',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        setError('곳간 ID가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const granaryData = await getGranary(id);
        setGranary(granaryData);
        setFormData({
          name: granaryData.name,
          purpose: granaryData.purpose,
          currency: granaryData.currency,
        });
      } catch (err: any) {
        setError(err.message || '곳간을 불러오는데 실패했습니다.');
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
      const updated = await updateGranary(id, formData);
      navigate(`/granaries/${updated.id}`);
    } catch (err: any) {
      setError(err.message || '곳간 수정에 실패했습니다.');
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

  if (error || !granary) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error || '곳간을 찾을 수 없습니다.'}</p>
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <button
          onClick={() => navigate(`/granaries/${granary.id}`)}
          className="text-blue-600 hover:underline"
        >
          ← 돌아가기
        </button>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">곳간 수정</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            곳간 이름
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 비상금 곳간"
          />
        </div>

        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-2">
            목적
          </label>
          <select
            id="purpose"
            required
            value={formData.purpose || ''}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {GRANARY_PURPOSES.map((purpose) => (
              <option key={purpose} value={purpose}>
                {purpose}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
            통화
          </label>
          <select
            id="currency"
            required
            value={formData.currency || ''}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(`/granaries/${granary.id}`)}
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

