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
      <h1 className="gk-page-title mb-8">새 곳간 만들기</h1>

      <form onSubmit={handleSubmit} className="gk-card gk-card-pad gk-stack">
        <div>
          <label htmlFor="name" className="gk-label">
            곳간 이름
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="gk-input"
            placeholder="예: 비상금 곳간"
          />
        </div>

        <div>
          <label htmlFor="purpose" className="gk-label">
            목적
          </label>
          <select
            id="purpose"
            required
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value as any })}
            className="gk-input"
          >
            {GRANARY_PURPOSES.map((purpose) => (
              <option key={purpose} value={purpose}>
                {purpose}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="currency" className="gk-label">
            통화
          </label>
          <select
            id="currency"
            required
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
            className="gk-input"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="gk-alert">
            <p className="gk-error-text">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex-1 px-4 py-2 border border-line rounded-md text-ink-muted hover:bg-surface-2"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-accent text-accent-contrast rounded-md hover:bg-accent-ink disabled:opacity-50"
          >
            {loading ? '생성 중...' : '만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
