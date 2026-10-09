import type { Dispatch, SetStateAction } from 'react';
import type { DraftPlan } from './model';
interface GoalMilestonesEditorProps {
  draft: DraftPlan;
  setDraft: Dispatch<SetStateAction<DraftPlan | null>>;
}

export function GoalMilestonesEditor({ draft, setDraft }: GoalMilestonesEditorProps) {
  return <>
    {draft.milestones.map((m, i) => (
      <div key={i} className="flex flex-wrap items-end gap-3">
        <div className="gk-field">
          <label className="gk-label-sm">목표 연도</label>
          <input
            type="number"
            value={m.year}
            onChange={(e) => {
              const milestones = [...draft.milestones];
              milestones[i] = { ...m, year: e.target.value };
              setDraft({ ...draft, milestones });
            }}
            className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
          />
        </div>
        <div className="gk-field">
          <label className="gk-label-sm">목표 금액(억원)</label>
          <input
            type="number"
            step="any"
            value={m.amountEok}
            onChange={(e) => {
              const milestones = [...draft.milestones];
              milestones[i] = { ...m, amountEok: e.target.value };
              setDraft({ ...draft, milestones });
            }}
            className="border border-line rounded-md px-2 py-1.5 text-sm w-28"
          />
        </div>
        {draft.milestones.length > 1 && (
          <button
            type="button"
            onClick={() => setDraft({ ...draft, milestones: draft.milestones.filter((_, j) => j !== i) })}
            className="text-xs text-ink-muted hover:underline pb-2"
          >
            삭제
          </button>
        )}
      </div>
    ))}
    <button
      type="button"
      onClick={() => setDraft({ ...draft, milestones: [...draft.milestones, { year: '', amountEok: '' }] })}
      className="text-xs text-accent hover:underline"
    >
      + 목표 추가
    </button>
  </>;
}
