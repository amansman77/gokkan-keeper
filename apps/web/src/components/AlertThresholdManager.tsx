import { useEffect, useState } from 'react';
import {
  getAlertThresholds,
  createAlertThreshold,
  updateAlertThreshold,
  deleteAlertThreshold,
  getMarketIndices,
} from '../lib/api';
import type { AlertThreshold } from '../lib/types';
import type { MarketIndex } from '../lib/api';

function directionLabel(direction: string): string {
  return direction === 'below' ? '이하로 하락' : '이상으로 상승';
}

export default function AlertThresholdManager() {
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'below' | 'above'>('below');
  const [value, setValue] = useState('');

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const [thresholdsData, indicesData] = await Promise.all([
        getAlertThresholds(),
        getMarketIndices(),
      ]);
      setThresholds(thresholdsData);
      setIndices(indicesData.indices);
      if (!symbol && indicesData.indices.length > 0) {
        setSymbol(indicesData.indices[0].symbol);
      }
    } catch (err: any) {
      setError(err.message || '임계값 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const thresholdValue = Number(value);
    if (!symbol || Number.isNaN(thresholdValue)) return;
    const indexName = indices.find((i) => i.symbol === symbol)?.name || symbol;

    setSubmitting(true);
    setError(null);
    try {
      await createAlertThreshold({
        symbol,
        label: indexName,
        direction,
        threshold: thresholdValue,
        enabled: true,
      });
      setValue('');
      await loadAll();
    } catch (err: any) {
      setError(err.message || '임계값 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(threshold: AlertThreshold) {
    try {
      await updateAlertThreshold(threshold.id, { enabled: !threshold.enabled });
      setThresholds((prev) => prev.map((t) => (t.id === threshold.id ? { ...t, enabled: !t.enabled } : t)));
    } catch (err: any) {
      setError(err.message || '임계값 수정에 실패했습니다.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAlertThreshold(id);
      setThresholds((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      setError(err.message || '임계값 삭제에 실패했습니다.');
    }
  }

  if (loading) {
    return (
      <div className="bg-surface rounded-lg shadow p-4">
        <h2 className="text-sm font-semibold text-ink-faint mb-3">알림 트리거 관리</h2>
        <div className="text-sm text-ink-faint">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg shadow p-4">
      <h2 className="text-sm font-semibold text-ink-faint mb-3">알림 트리거 관리</h2>
      <p className="text-xs text-ink-faint mb-4">시장 지수가 기준값을 처음 넘는 순간에 1회 디스코드로 알림이 갑니다.</p>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      {thresholds.length > 0 && (
        <div className="divide-y divide-line-soft mb-4">
          {thresholds.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={t.enabled}
                onChange={() => handleToggle(t)}
                className="w-4 h-4"
                aria-label={`${t.label} 활성화 여부`}
              />
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${t.enabled ? 'text-ink' : 'text-ink-faint'}`}>
                  {t.label}
                </span>
                <span className={`text-sm ml-2 ${t.enabled ? 'text-ink-muted' : 'text-ink-faint'}`}>
                  {t.threshold.toLocaleString('ko-KR')}원 {directionLabel(t.direction)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                className="text-xs text-ink-faint hover:text-danger px-2 py-1"
                aria-label={`${t.label} 삭제`}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label className="text-xs text-ink-faint mb-1">지수</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="border border-line rounded-md px-2 py-1.5 text-sm"
          >
            {indices.map((idx) => (
              <option key={idx.symbol} value={idx.symbol}>
                {idx.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-ink-faint mb-1">조건</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'below' | 'above')}
            className="border border-line rounded-md px-2 py-1.5 text-sm"
          >
            <option value="below">이하로 하락 시</option>
            <option value="above">이상으로 상승 시</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-ink-faint mb-1">기준값</label>
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="예: 870"
            required
            className="border border-line rounded-md px-2 py-1.5 text-sm w-28"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !symbol || !value}
          className="bg-accent text-accent-contrast px-4 py-1.5 rounded-md text-sm font-medium hover:bg-accent-ink disabled:opacity-50"
        >
          {submitting ? '추가 중...' : '추가'}
        </button>
      </form>
    </div>
  );
}
