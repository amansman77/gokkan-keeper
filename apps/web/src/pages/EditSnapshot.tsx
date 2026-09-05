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
        <div className="text-ink-muted">로딩 중...</div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-danger-tint border border-danger rounded-md p-4">
          <p className="text-danger">{error || '스냅샷을 찾을 수 없습니다.'}</p>
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

  const granary = granaries.find((g) => g.id === snapshot.granaryId);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <button
          onClick={() => navigate(`/granaries/${snapshot.granaryId}`)}
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

      <h1 className="text-3xl font-bold text-ink mb-8">스냅샷 수정</h1>

      {granary && (
        <div className="mb-6 p-4 bg-surface-2 rounded-lg">
          <p className="text-sm text-ink-muted">곳간</p>
          <p className="font-medium">{granary.name} ({granary.purpose})</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface rounded-lg shadow p-6 space-y-6">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-ink-muted mb-2">
            날짜
          </label>
          <input
            type="date"
            id="date"
            required
            value={formData.date || ''}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="totalAmount" className="block text-sm font-medium text-ink-muted mb-2">
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
            className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="availableBalance" className="block text-sm font-medium text-ink-muted mb-2">
            예수금 (선택)
          </label>
          <input
            type="number"
            id="availableBalance"
            min="0"
            step="0.01"
            value={formData.availableBalance ?? ''}
            onChange={(e) => setFormData({ ...formData, availableBalance: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => setFormData({ ...formData, availableBalance: null })}
            className="mt-2 text-sm text-ink-muted hover:text-ink"
          >
            예수금 제거
          </button>
        </div>

        <div>
          <label htmlFor="profitLoss" className="block text-sm font-medium text-ink-muted mb-2">
            평가 손익 (선택)
          </label>
          <input
            type="number"
            id="profitLoss"
            step="0.01"
            value={formData.profitLoss ?? ''}
            onChange={(e) => setFormData({ ...formData, profitLoss: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="양수: 수익, 음수: 손실"
          />
          <button
            type="button"
            onClick={() => setFormData({ ...formData, profitLoss: null })}
            className="mt-2 text-sm text-ink-muted hover:text-ink"
          >
            평가 손익 제거
          </button>
        </div>

        <div>
          <label htmlFor="memo" className="block text-sm font-medium text-ink-muted mb-2">
            메모 (선택)
          </label>
          <textarea
            id="memo"
            rows={3}
            value={formData.memo || ''}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="간단한 메모를 남기세요"
          />
          <button
            type="button"
            onClick={() => setFormData({ ...formData, memo: null })}
            className="mt-2 text-sm text-ink-muted hover:text-ink"
          >
            메모 제거
          </button>
        </div>

        {error && (
          <div className="bg-danger-tint border border-danger rounded-md p-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(`/granaries/${snapshot.granaryId}`)}
            className="flex-1 px-4 py-2 border border-line rounded-md text-ink-muted hover:bg-surface-2"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-accent text-accent-contrast rounded-md hover:bg-accent-ink disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  );
}

