import { useState } from 'react';
import type { CreateJudgmentDiaryEntry, JudgmentDiaryEntry } from '../lib/types';
import { JUDGMENT_ACTIONS } from '@gokkan-keeper/shared';

interface JudgmentDiaryFormProps {
  initialValue?: JudgmentDiaryEntry;
  onSubmit: (data: CreateJudgmentDiaryEntry) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  submittingLabel: string;
}

export default function JudgmentDiaryForm({
  initialValue,
  onSubmit,
  onCancel,
  submitLabel,
  submittingLabel,
}: JudgmentDiaryFormProps) {
  const [title, setTitle] = useState<string>(initialValue?.title || '');
  const [summary, setSummary] = useState<string>(initialValue?.summary || '');
  const [mainContent, setMainContent] = useState<string>(initialValue?.mainContent || '');
  const [action, setAction] = useState<JudgmentDiaryEntry['action']>(initialValue?.action || 'WATCH');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: CreateJudgmentDiaryEntry = {
        title: title.trim(),
        summary: summary.trim(),
        mainContent: mainContent.trim(),
        action,
      };

      await onSubmit(payload);
    } catch (err: any) {
      setError(err.message || '판단일지 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="gk-card gk-card-pad gk-stack">
      <div>
        <label className="gk-label">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="gk-input"
          required
        />
      </div>

      <div>
        <label className="gk-label">한 줄 판단</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          className="gk-input"
          required
        />
      </div>

      <div>
        <label className="gk-label">메인 컨텐츠</label>
        <textarea
          value={mainContent}
          onChange={(e) => setMainContent(e.target.value)}
          rows={12}
          className="gk-input"
          required
        />
      </div>

      <div>
        <label className="gk-label">실행(Action)</label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as any)}
          className="w-full px-3 py-2 border border-line rounded-md"
          required
        >
          {JUDGMENT_ACTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="gk-alert">
          <p className="gk-error-text">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="gk-btn gk-btn-secondary flex-1"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="gk-btn gk-btn-primary flex-1"
        >
          {loading ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
