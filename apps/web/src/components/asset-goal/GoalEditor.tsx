import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { GoalAssumptionsEditor } from './GoalAssumptionsEditor';
import { GoalMilestonesEditor } from './GoalMilestonesEditor';
import type { DraftPlan } from './model';
interface GoalEditorProps {
  draft: DraftPlan;
  setDraft: Dispatch<SetStateAction<DraftPlan | null>>;
  saving: boolean;
  hasUsd: boolean;
  usdKrw: number | null;
  excluded: string[];
  handleSave: (event: FormEvent) => Promise<void>;
  handleResetBaseline: () => void;
}

export function GoalEditor({ draft, setDraft, saving, hasUsd, usdKrw, excluded, handleSave, handleResetBaseline }: GoalEditorProps) {
  return (
    <form onSubmit={handleSave} className="mt-4 pt-4 border-t border-line space-y-3">
      <GoalMilestonesEditor draft={draft} setDraft={setDraft} />
      <GoalAssumptionsEditor draft={draft} setDraft={setDraft}>
        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-accent-contrast px-4 py-1.5 rounded-md text-sm font-medium hover:bg-accent-ink disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={handleResetBaseline}
          disabled={saving || (hasUsd && !usdKrw) || excluded.length > 0}
          className="px-3 py-1.5 text-sm text-ink-muted border border-line rounded-md hover:bg-surface-2 disabled:opacity-50"
        >
          경로 기준점을 오늘로
        </button>
      </GoalAssumptionsEditor>
    </form>
  );
}
