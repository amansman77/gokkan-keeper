import { useEffect, useState } from 'react';
import { getMarketIndices } from '../lib/api';
import type { MarketIndex } from '../lib/api';

function formatValue(index: MarketIndex): string {
  if (index.symbol === 'KRW=X') {
    return index.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  }
  if (index.symbol === '^VIX') {
    return index.value.toFixed(2);
  }
  return index.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function formatChange(change: number | null, changeRate: number | null): string {
  if (change === null || changeRate === null) return '';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)} (${sign}${changeRate.toFixed(2)}%)`;
}

export default function MarketIndices() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMarketIndices()
      .then((data) => setIndices(data.indices))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">시장 지수</h2>
        <div className="text-sm text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (error || indices.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-500 mb-3">시장 지수</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {indices.map((index) => {
          const isUp = (index.change ?? 0) >= 0;
          const changeColor = index.change === null ? 'text-gray-400' : isUp ? 'text-red-500' : 'text-blue-500';
          return (
            <div key={index.symbol} className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">{index.name}</span>
              <span className="text-sm font-bold text-gray-900">{formatValue(index)}</span>
              {index.change !== null && (
                <span className={`text-xs ${changeColor}`}>
                  {formatChange(index.change, index.changeRate)}
                </span>
              )}
              <span className="text-xs text-gray-400 mt-0.5">{index.asOfDate}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
