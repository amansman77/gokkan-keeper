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
      <div className="gk-loading">
        <div className="text-ink-muted">로딩 중...</div>
      </div>
    );
  }

  if (error || !granary) {
    return (
      <div className="gk-narrow">
        <div className="gk-alert">
          <p className="text-danger">{error || '곳간을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-accent hover:underline mt-2 inline-block"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gk-narrow">
      <div className="mb-4">
        <button
          onClick={() => navigate(`/granaries/${granary.id}`)}
          className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-2 rounded-md transition-colors"
          aria-label="돌아가기"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="w-4 h-4 shrink-0 text-ink-faint"
          >
            <path
              d="M10 3.5 5.5 8 10 12.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>돌아가기</span>
        </button>
      </div>

      <h1 className="gk-page-title mb-8">곳간 수정</h1>

      <form onSubmit={handleSubmit} className="gk-card gk-card-pad gk-stack">
        <div>
          <label htmlFor="name" className="gk-label">
            곳간 이름
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name || ''}
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
            value={formData.purpose || ''}
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
            value={formData.currency || ''}
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
            onClick={() => navigate(`/granaries/${granary.id}`)}
            className="gk-btn gk-btn-secondary flex-1"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="gk-btn gk-btn-primary flex-1"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
