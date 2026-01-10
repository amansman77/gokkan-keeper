import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGranaries, getStatus } from '../lib/api';
import { API_BASE_URL, API_SECRET } from '../lib/config';
import type { Granary, Snapshot, StatusSummary } from '../lib/types';
import GranaryCard from '../components/GranaryCard';
import StatusSummaryComponent from '../components/StatusSummary';

export default function Dashboard() {
  const [granaries, setGranaries] = useState<(Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot })[]>([]);
  const [status, setStatus] = useState<StatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800 font-semibold mb-2">오류 발생</p>
        <p className="text-red-700 text-sm">{error}</p>
        <div className="mt-4 text-xs text-red-600">
          <p>API URL: {API_BASE_URL}</p>
          <p>API Secret: {API_SECRET ? '설정됨' : '설정되지 않음'}</p>
          <p>Raw env: {import.meta.env.VITE_API_BASE_URL || '(undefined)'}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">곳간 목록</h1>
        <p className="text-gray-600">목적별로 정리된 자산을 확인하세요</p>
      </div>

      {status && <StatusSummaryComponent status={status} />}

      {granaries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">아직 등록된 곳간이 없습니다.</p>
          <Link
            to="/granaries/new"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700"
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

