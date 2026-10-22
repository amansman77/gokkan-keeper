import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getGranaryExport } from '../../lib/api';
import type { GranaryWithLatestSnapshot } from '../../lib/types';

interface GranaryHeaderProps {
  granary: GranaryWithLatestSnapshot;
}

export function GranaryHeader({ granary }: GranaryHeaderProps) {
  const [downloading, setDownloading] = useState(false);
  const handleDownloadJson = async () => {
    if (!granary) return;
    try {
      setDownloading(true);
      const payload = await getGranaryExport(granary.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = granary.name.replace(/\s+/g, '-').toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `granary-${safeName}-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert((err instanceof Error && err.message) || 'JSON 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-2 rounded-md transition-colors"
          aria-label="대시보드로 돌아가기"
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
          <span>대시보드</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadJson}
            disabled={downloading}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-ink-muted border border-line rounded-md hover:bg-surface-2 disabled:opacity-60 transition-colors"
          >
            {downloading ? '다운로드 중...' : 'JSON 다운로드'}
          </button>
          <Link
            to={`/granaries/${granary.id}/edit`}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-accent border border-accent rounded-md hover:bg-accent-tint transition-colors"
          >
            수정
          </Link>
        </div>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight break-keep">{granary.name}</h1>
        <p className="text-ink-muted text-sm mt-1">{granary.purpose} · {granary.currency}</p>
      </div>
    </div>
  );
}
