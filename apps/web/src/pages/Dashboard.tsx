import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllGranariesExport, getGranaries, getStatus } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import type { Granary, Snapshot, StatusSummary } from '../lib/types';
import GranaryCard from '../components/GranaryCard';
import StatusSummaryComponent from '../components/StatusSummary';
import MarketIndices from '../components/MarketIndices';

export default function Dashboard() {
  const [granaries, setGranaries] = useState<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]>([]);
  const [status, setStatus] = useState<StatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [granariesData, statusData] = await Promise.all([
          getGranaries(),
          getStatus(),
        ]);
        setGranaries(granariesData);
        setStatus(statusData);
      } catch (err: any) {
        console.error('Failed to load data:', err);
        setError(err.message || '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-ink-muted">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-loss-tint border border-loss rounded-md p-4">
        <p className="text-loss font-semibold mb-2">오류 발생</p>
        <p className="text-loss text-sm">{error}</p>
        {import.meta.env.DEV ? (
          <div className="mt-4 text-xs text-loss">
            <p>API URL: {API_BASE_URL}</p>
            <p>Raw env: {import.meta.env.VITE_API_BASE_URL || '(undefined)'}</p>
          </div>
        ) : null}
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-loss text-accent-contrast rounded-md hover:bg-loss text-sm"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const handleDownloadAll = async () => {
    try {
      setDownloading(true);
      const payload = await getAllGranariesExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `granaries-all-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'JSON 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink mb-2">곳간 목록</h1>
          <p className="text-ink-muted">목적별로 정리된 자산을 확인하세요</p>
        </div>
        {granaries.length > 0 && (
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="px-4 py-2 text-sm text-ink-muted border border-line rounded-md hover:bg-surface-2 disabled:opacity-60 whitespace-nowrap"
          >
            {downloading ? '다운로드 중...' : 'JSON 다운로드'}
          </button>
        )}
      </div>

      <MarketIndices />

      {status && <StatusSummaryComponent status={status} />}

      {granaries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-faint mb-4">아직 등록된 곳간이 없습니다.</p>
          <Link
            to="/granaries/new"
            className="inline-block bg-accent text-accent-contrast px-6 py-3 rounded-md font-medium hover:bg-accent-ink"
          >
            첫 번째 곳간 만들기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {granaries.map((granary) => (
            <GranaryCard key={granary.id} granary={granary} />
          ))}
        </div>
      )}
    </div>
  );
}
