import { useEffect, useState } from 'react';
import { getCashFlows, createCashFlow, deleteCashFlow } from '../lib/api';
import type { CashFlow } from '../lib/types';
import { formatCurrency, formatDate } from '@gokkan-keeper/shared';

interface CashFlowManagerProps {
  granaryId: string;
  currency: string;
}

export default function CashFlowManager({ granaryId, currency }: CashFlowManagerProps) {
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const data = await getCashFlows(granaryId);
      setCashFlows(data);
    } catch (err: any) {
      setError(err.message || '입출금 기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granaryId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const amountValue = Number(amount);
    if (!date || Number.isNaN(amountValue) || amountValue <= 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await createCashFlow({
        granaryId,
        date,
        type,
        amount: amountValue,
        memo: memo || undefined,
      });
      setAmount('');
      setMemo('');
      await loadAll();
    } catch (err: any) {
      setError(err.message || '입출금 기록 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCashFlow(id);
      setCashFlows((prev) => prev.filter((cf) => cf.id !== id));
    } catch (err: any) {
      setError(err.message || '입출금 기록 삭제에 실패했습니다.');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">입출금 기록</h2>
      <p className="text-xs text-gray-400 mb-4">
        스냅샷 총액에는 매매로 생긴 평가손익뿐 아니라 이 곳간에 새로 넣거나 뺀 돈도 섞여 있어요. 여기 입출금을 기록해두면
        나중에 실제 투자 성과(시간가중수익률)를 원금 증가분과 분리해서 계산할 수 있어요.
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading ? (
        <div className="text-sm text-gray-400">로딩 중...</div>
      ) : cashFlows.length > 0 ? (
        <div className="divide-y divide-gray-100 mb-4">
          {cashFlows.map((cf) => (
            <div key={cf.id} className="flex items-center gap-3 py-2">
              <span className="text-sm text-gray-500 w-24 shrink-0">{formatDate(cf.date)}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${cf.type === 'DEPOSIT' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                {cf.type === 'DEPOSIT' ? '입금' : '출금'}
              </span>
              <span className="text-sm font-medium flex-1">
                {formatCurrency(cf.amount, currency)}
              </span>
              {cf.memo && <span className="text-xs text-gray-400 truncate max-w-[10rem]">{cf.memo}</span>}
              <button
                type="button"
                onClick={() => handleDelete(cf.id)}
                className="text-xs text-gray-400 hover:text-red-600 px-2 py-1"
                aria-label="입출금 기록 삭제"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-4">아직 입출금 기록이 없습니다.</p>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">구분</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'DEPOSIT' | 'WITHDRAWAL')}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          >
            <option value="DEPOSIT">입금</option>
            <option value="WITHDRAWAL">출금</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">금액</label>
          <input
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="예: 4000000"
            required
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-32"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">메모(선택)</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 정기 적립"
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-36"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !date || !amount}
          className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? '추가 중...' : '추가'}
        </button>
      </form>
    </div>
  );
}
