import { GRANARY_PURPOSES } from '@gokkan-keeper/shared';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { DraftPlan } from './model';
interface GoalAssumptionsEditorProps {
  draft: DraftPlan;
  setDraft: Dispatch<SetStateAction<DraftPlan | null>>;
  children: ReactNode;
}

export function GoalAssumptionsEditor({ draft, setDraft, children }: GoalAssumptionsEditorProps) {
  return <>
    <div className="flex flex-wrap items-center gap-3">
      <span className="gk-label-sm">합계에서 제외할 곳간 목적</span>
      {GRANARY_PURPOSES.map((purpose) => (
        <label key={purpose} className="flex items-center gap-1 text-sm text-ink">
          <input
            type="checkbox"
            checked={draft.excludedPurposes.includes(purpose)}
            onChange={(e) =>
              setDraft({
                ...draft,
                excludedPurposes: e.target.checked
                  ? [...draft.excludedPurposes, purpose]
                  : draft.excludedPurposes.filter((p) => p !== purpose),
              })
            }
          />
          {purpose}
        </label>
      ))}
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <div className="gk-field">
        <label className="gk-label-sm">월 납입(만원)</label>
        <input
          type="number"
          step="any"
          value={draft.monthlyContributionMan}
          onChange={(e) => setDraft({ ...draft, monthlyContributionMan: e.target.value })}
          className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
        />
      </div>
      <div className="gk-field">
        <label className="gk-label-sm">기대 수익률(연 %)</label>
        <input
          type="number"
          step="any"
          value={draft.expectedReturnPct}
          onChange={(e) => setDraft({ ...draft, expectedReturnPct: e.target.value })}
          className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
        />
      </div>
      <div className="gk-field">
        <label className="gk-label-sm">전략 목표 수익률(연 %)</label>
        <input
          type="number"
          step="any"
          value={draft.targetReturnPct}
          onChange={(e) => setDraft({ ...draft, targetReturnPct: e.target.value })}
          className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
        />
      </div>
      <div className="gk-field">
        <label className="gk-label-sm">손실 한도(%)</label>
        <input
          type="number"
          step="any"
          value={draft.maxDrawdownPct}
          onChange={(e) => setDraft({ ...draft, maxDrawdownPct: e.target.value })}
          className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
        />
      </div>
      {children}
    </div></>;
}
