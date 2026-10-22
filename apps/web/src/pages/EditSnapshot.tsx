import { useNavigate, useParams } from 'react-router-dom';
import { EditSnapshotAmounts } from '../components/snapshot-form/EditSnapshotAmounts';
import { EditSnapshotHeader } from '../components/snapshot-form/EditSnapshotHeader';
import { SnapshotDateField, SnapshotMemoField } from '../components/snapshot-form/SnapshotFields';
import { useEditSnapshot } from '../components/snapshot-form/useEditSnapshot';
import { updateSnapshot } from '../lib/api';

export default function EditSnapshot() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { granaries, snapshot, formData, setFormData, loading, saving, setSaving, error, setError } = useEditSnapshot(id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await updateSnapshot(id, formData);
      void navigate(`/granaries/${updated.granaryId}`);
    } catch (err: unknown) {
      setError((err instanceof Error && err.message) || '스냅샷 수정에 실패했습니다.');
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

  if (error || !snapshot) {
    return (
      <div className="gk-narrow">
        <div className="gk-alert">
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
    <div className="gk-narrow">
      <EditSnapshotHeader snapshot={snapshot} granary={granary} />

      <form onSubmit={handleSubmit} className="gk-card gk-card-pad gk-stack">
        <SnapshotDateField value={formData.date} onChange={date => setFormData({ ...formData, date })} />

        <EditSnapshotAmounts formData={formData} setFormData={setFormData} />

        <SnapshotMemoField value={formData.memo} onChange={memo => setFormData({ ...formData, memo })}>
          <button type="button" onClick={() => setFormData({ ...formData, memo: null })} className="mt-2 text-sm text-ink-muted hover:text-ink">메모 제거</button>
        </SnapshotMemoField>

        {error && (
          <div className="gk-alert">
            <p className="gk-error-text">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(`/granaries/${snapshot.granaryId}`)}
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

