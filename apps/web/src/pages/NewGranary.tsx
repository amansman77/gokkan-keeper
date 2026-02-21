import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGranary } from '../lib/api';
import type { CreateGranary } from '../lib/types';
import { GRANARY_PURPOSES, CURRENCIES, DEFAULT_OWNER } from '@gokkan-keeper/shared';

export default function NewGranary() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateGranary>({
    name: '',
    purpose: '비상금',
    currency: 'KRW',
    owner: DEFAULT_OWNER,
    isPublic: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const granary = await createGranary(formData);
      navigate(`/granaries/${granary.id}`);
    } catch (err: any) {
      setError(err.message || '곳간 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">새 곳간 만들기</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            곳간 이름
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
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
            value={formData.purpose}
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
            value={formData.currency}
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
            onClick={() => navigate('/')}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '생성 중...' : '만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
