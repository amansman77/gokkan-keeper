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
    <form onSubmit={handleSubmit} className="bg-surface rounded-lg shadow p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">한 줄 판단</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">메인 컨텐츠</label>
        <textarea
          value={mainContent}
          onChange={(e) => setMainContent(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">실행(Action)</label>
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
        <div className="bg-loss-tint border border-loss rounded-md p-4">
          <p className="text-loss text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-line rounded-md text-ink-muted hover:bg-surface-2"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-accent text-accent-contrast rounded-md hover:bg-accent-ink disabled:opacity-50"
        >
          {loading ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
