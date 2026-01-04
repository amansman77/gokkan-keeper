import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGranary, getSnapshots } from '../lib/api';
import type { GranaryWithLatestSnapshot, Snapshot } from '../lib/types';
import { formatCurrency, formatDate } from '@gokkan-keeper/shared';

export default function GranaryDetail() {
  const { id } = useParams<{ id: string }>();
  const [granary, setGranary] = useState<GranaryWithLatestSnapshot | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('곳간 ID가 없습니다.');
      setLoading(false);
      return;
    }
    
    const granaryId = id; // Type narrowing
    
    async function loadData() {
      try {
        setLoading(true);
        const [granaryData, snapshotsData] = await Promise.all([
          getGranary(granaryId),
          getSnapshots(granaryId),
        ]);
        setGranary(granaryData);
        setSnapshots(snapshotsData);
      } catch (err: any) {
        setError(err.message || '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error || !granary) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error || '곳간을 찾을 수 없습니다.'}</p>
        <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
          ← 대시보드로 돌아가기
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{granary.name}</h1>
            <p className="text-gray-600 mt-1">{granary.purpose} · {granary.currency}</p>
          </div>
          <Link
            to={`/granaries/${granary.id}/edit`}
            className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
          >
            수정
          </Link>
        </div>
      </div>

      {granary.latestSnapshot && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">최신 스냅샷</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">날짜:</span>
              <span className="font-medium">{formatDate(granary.latestSnapshot.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">총 평가 금액:</span>
              <span className="font-bold text-lg">
                {formatCurrency(granary.latestSnapshot.totalAmount, granary.currency)}
              </span>
            </div>
            {granary.latestSnapshot.availableBalance !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">예수금:</span>
                <span className="font-medium">
                  {formatCurrency(granary.latestSnapshot.availableBalance, granary.currency)}
                </span>
              </div>
            )}
            {granary.latestSnapshot.memo && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-gray-600 text-sm">{granary.latestSnapshot.memo}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">스냅샷 기록</h2>
          <Link
            to={`/snapshots/new?granaryId=${id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            새 스냅샷 추가
          </Link>
        </div>

        {snapshots.length === 0 ? (
          <p className="text-gray-500 text-center py-8">아직 스냅샷이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="border-b pb-4 last:border-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">{formatDate(snapshot.date)}</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(snapshot.totalAmount, granary.currency)}
                    </p>
                    {snapshot.memo && (
                      <p className="text-gray-600 text-sm mt-2">{snapshot.memo}</p>
                    )}
                  </div>
                  <Link
                    to={`/snapshots/${snapshot.id}/edit?granaryId=${granary.id}`}
                    className="ml-4 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    수정
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

