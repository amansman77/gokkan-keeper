import { Link } from 'react-router-dom';
import type { Granary, Snapshot } from '../lib/types';
import { formatCurrency, formatDate, calculateComparison } from '@gokkan-keeper/shared';

interface GranaryCardProps {
  granary: Granary & { latestSnapshot?: Snapshot; previousSnapshot?: Snapshot };
}

export default function GranaryCard({ granary }: GranaryCardProps) {
  const comparison = granary.latestSnapshot && granary.previousSnapshot
    ? calculateComparison(
        granary.latestSnapshot.totalAmount,
        granary.previousSnapshot.totalAmount
      )
    : null;

  return (
    <Link
      to={`/granaries/${granary.id}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{granary.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{granary.purpose}</p>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {granary.currency}
        </span>
      </div>

      {granary.latestSnapshot ? (
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-600">최신 기록</span>
            <span className="text-2xl font-bold text-gray-900">
              {formatCurrency(granary.latestSnapshot.totalAmount, granary.currency)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {formatDate(granary.latestSnapshot.date)}
            </p>
            {comparison && (
              <div className={`text-sm font-medium ${comparison.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {comparison.isPositive ? '+' : ''}{formatCurrency(comparison.amountDiff, granary.currency)} ({comparison.isPositive ? '+' : ''}{comparison.percentDiff.toFixed(1)}%)
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">아직 스냅샷이 없습니다</p>
        </div>
      )}
    </Link>
  );
}

