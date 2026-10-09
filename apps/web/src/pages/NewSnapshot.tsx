import { useNavigate, useSearchParams } from 'react-router-dom';
import { NewSnapshotBalance } from '../components/snapshot-form/NewSnapshotBalance';
import { NewSnapshotProfit } from '../components/snapshot-form/NewSnapshotProfit';
import { NewSnapshotTotal } from '../components/snapshot-form/NewSnapshotTotal';
import { SnapshotDateField, SnapshotMemoField } from '../components/snapshot-form/SnapshotFields';
import { useNewSnapshot } from '../components/snapshot-form/useNewSnapshot';
import { createSnapshot } from '../lib/api';

export default function NewSnapshot() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const granaryIdParam = searchParams.get('granaryId');

  const state = useNewSnapshot(granaryIdParam);
  const { loadingGranaries, granaries, formData, setFormData, loading, setLoading, error, setError, applyLatestSnapshotDefaults } = state;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const snapshot = await createSnapshot(formData);
      void navigate(`/granaries/${snapshot.granaryId}`);
    } catch (err: unknown) {
      setError((err instanceof Error && err.message) || '스냅샷 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingGranaries) {
    return <div className="gk-loading"><div className="text-ink-muted">로딩 중...</div></div>;
  }

  return (
    <div className="gk-narrow">
      <h1 className="gk-page-title mb-8">새 스냅샷 추가</h1>

      <form onSubmit={handleSubmit} className="gk-card gk-card-pad gk-stack">
        <div>
          <label htmlFor="granaryId" className="gk-label">
            곳간
          </label>
          <select
            id="granaryId"
            required
            value={formData.granaryId}
            onChange={(e) => applyLatestSnapshotDefaults(e.target.value, granaries)}
            className="gk-input"
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

        <SnapshotDateField value={formData.date} onChange={date => setFormData({ ...formData, date })} />

        <NewSnapshotTotal state={state} />

        <NewSnapshotBalance state={state} />

        <NewSnapshotProfit state={state} />

        <SnapshotMemoField value={formData.memo} onChange={memo => setFormData({ ...formData, memo })} />

        {error && (
          <div className="gk-alert">
            <p className="gk-error-text">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="gk-btn gk-btn-secondary flex-1"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="gk-btn gk-btn-primary flex-1"
          >
            {loading ? '생성 중...' : '추가하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
