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
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">한 줄 판단</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">실행(Action)</label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
