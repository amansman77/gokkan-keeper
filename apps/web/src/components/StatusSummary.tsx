import { Link } from 'react-router-dom';
import type { StatusSummary } from '../lib/types';
import { formatDate } from '@gokkan-keeper/shared';

interface StatusSummaryProps {
  status: StatusSummary;
}

export default function StatusSummaryComponent({ status }: StatusSummaryProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">곳간 지기 요약</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">총 곳간 수</p>
          <p className="text-2xl font-bold text-gray-900">{status.totalGranaries}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">총 스냅샷 수</p>
          <p className="text-2xl font-bold text-gray-900">{status.totalSnapshots}</p>
        </div>
      </div>

      {status.oldestUnupdatedGranary && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600 mb-2">오래 업데이트되지 않은 곳간</p>
          <div className="flex justify-between items-center">
            <Link
              to={`/granaries/${status.oldestUnupdatedGranary.granary.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {status.oldestUnupdatedGranary.granary.name}
            </Link>
            <span className="text-sm text-gray-600">
              {status.oldestUnupdatedGranary.daysSinceUpdate}일 전
            </span>
          </div>
        </div>
      )}

      {status.recentSnapshots && status.recentSnapshots.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600 mb-2">최근 스냅샷</p>
          <div className="space-y-2">
            {status.recentSnapshots.slice(0, 3).map((snapshot) => (
              <div key={snapshot.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{snapshot.date ? formatDate(snapshot.date) : '-'}</span>
                <span className="text-gray-900 font-medium">
                  {snapshot.totalAmount != null ? snapshot.totalAmount.toLocaleString() : '0'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

