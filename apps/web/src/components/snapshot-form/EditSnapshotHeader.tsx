import { useNavigate } from 'react-router-dom';
import type { Granary, Snapshot } from '../../lib/types';
interface EditSnapshotHeaderProps {
  snapshot: Snapshot;
  granary?: Granary;
}

export function EditSnapshotHeader({ snapshot, granary }: EditSnapshotHeaderProps) {
  const navigate = useNavigate(); return <>
    <div className="mb-4">
      <button
        onClick={() => navigate(`/granaries/${snapshot.granaryId}`)}
        className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-2 rounded-md transition-colors"
        aria-label="돌아가기"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="w-4 h-4 shrink-0 text-ink-faint"
        >
          <path
            d="M10 3.5 5.5 8 10 12.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>돌아가기</span>
      </button>
    </div>

    <h1 className="gk-page-title mb-8">스냅샷 수정</h1>

    {granary && (
      <div className="mb-6 p-4 bg-surface-2 rounded-lg">
        <p className="gk-hint">곳간</p>
        <p className="font-medium">{granary.name} ({granary.purpose})</p>
      </div>
    )}

  </>;
}
