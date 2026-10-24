import { useState } from 'react';
import type { ApplyImport, ImportJob } from '@gokkan-keeper/shared';
import { ImportChecks } from './ImportChecks';
import { ImportProposalView } from './ImportProposalView';

interface ImportReviewProps {
  job: ImportJob;
  busy: string | null;
  onApply: (options: ApplyImport) => void;
  onDiscard: () => void;
}

/** The parsed result: checks, the proposal, and the owner's decision. */
export function ImportReview({ job, busy, onApply, onDiscard }: ImportReviewProps) {
  const result = job.result!;
  const proposal = result.proposal;
  // holdings with a known symbol are registered unless the owner unticks them
  const [createNew, setCreateNew] = useState(() => new Set((proposal?.newHoldings ?? []).flatMap((n, i) => (n.suggestion ? [i] : []))));
  const [zeroMissing, setZeroMissing] = useState(false);
  const blocked = result.checks.some((c) => !c.passed) || !proposal;
  const toggle = (index: number) => setCreateNew((prev) => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });
  return (
    <div className="gk-stack">
      <ImportChecks result={result} />
      <ImportProposalView result={result} createNew={createNew} onToggleNew={toggle} zeroMissing={zeroMissing} onToggleMissing={() => setZeroMissing((v) => !v)} />
      {blocked && <p className="text-sm text-danger">검증을 통과하지 못해 반영할 수 없어요. 빠진 화면을 포함해 다시 올려주세요.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="gk-btn gk-btn-primary" disabled={blocked || !!busy} onClick={() => onApply({ createNew: [...createNew], zeroMissing })}>
          {busy ?? '곳간에 반영'}
        </button>
        <button type="button" className="gk-btn gk-btn-secondary" disabled={!!busy} onClick={onDiscard}>취소</button>
      </div>
    </div>
  );
}
