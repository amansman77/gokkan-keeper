import { Link } from 'react-router-dom';
import type { ImportJob } from '@gokkan-keeper/shared';

interface ImportOutcomeProps {
  job: ImportJob;
  busy: string | null;
  backTo: string;
  onRetry: () => void;
  onReset: () => void;
}

/** Terminal states: a failed read (retry or start over), or applied/discarded. */
export function ImportOutcome({ job, busy, backTo, onRetry, onReset }: ImportOutcomeProps) {
  if (job.status === 'failed') {
    return (
      <div className="gk-card gk-card-pad gk-stack">
        <p className="text-sm text-danger">{job.error ?? '판독에 실패했어요'}</p>
        <div className="flex gap-2">
          <button type="button" className="gk-btn gk-btn-primary" disabled={!!busy} onClick={onRetry}>다시 판독</button>
          <button type="button" className="gk-btn gk-btn-secondary" onClick={onReset}>새로 올리기</button>
        </div>
      </div>
    );
  }
  return (
    <div className="gk-card gk-card-pad gk-stack">
      <p className="text-sm text-ink">{job.status === 'applied' ? '곳간에 반영했어요.' : '취소했어요. 이미지는 삭제됐어요.'}</p>
      <Link to={backTo} className="gk-btn gk-btn-primary self-start">곳간으로 돌아가기</Link>
    </div>
  );
}
