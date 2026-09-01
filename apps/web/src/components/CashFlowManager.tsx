import { useEffect, useState } from 'react';
import { getCashFlows, createCashFlow, deleteCashFlow } from '../lib/api';
import type { CashFlow } from '../lib/types';
import { formatCurrency, formatDate } from '@gokkan-keeper/shared';

interface CashFlowManagerProps {
  granaryId: string;
  currency: string;
  onDepositDatesChange?: (dates: string[]) => void;
}

export default function CashFlowManager({ granaryId, currency, onDepositDatesChange }: CashFlowManagerProps) {
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
      onDepositDatesChange?.(data.filter((cf) => cf.type === 'DEPOSIT').map((cf) => cf.date));
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
      const next = cashFlows.filter((cf) => cf.id !== id);
      setCashFlows(next);
      onDepositDatesChange?.(next.filter((cf) => cf.type === 'DEPOSIT').map((cf) => cf.date));
    } catch (err: any) {
      setError(err.message || '입출금 기록 삭제에 실패했습니다.');
    }
  }

  return (
    <div className="gd-section">
      <div className="gd-section-head">
        <div>
          <div className="gd-eyebrow">입출금 기록</div>
          <div className="gd-section-title">
            이 곳간의 원금 변동
            {cashFlows.length > 0 && <span className="gd-count">({cashFlows.length})</span>}
          </div>
          <p className="gd-section-note">
            스냅샷 총액에는 매매로 생긴 평가손익뿐 아니라 새로 넣거나 뺀 돈도 섞여 있어요. 여기 남긴 기록으로 실제
            투자 성과를 원금 증가분과 분리해 계산할 수 있어요.
          </p>
        </div>
      </div>

      {error && <p className="gd-error">{error}</p>}

      {loading ? (
        <p className="gd-empty">로딩 중...</p>
      ) : cashFlows.length > 0 ? (
        <div className="gd-list">
          {cashFlows.map((cf) => (
            <div key={cf.id} className="gd-ledger-row">
              <span className="gd-date">{formatDate(cf.date)}</span>
              <span className={`gd-chip gd-flow-chip ${cf.type === 'DEPOSIT' ? 'gd-deposit' : 'gd-withdrawal'}`}>
                {cf.type === 'DEPOSIT' ? '입금' : '출금'}
              </span>
              <span className="gd-memo">{cf.memo || ''}</span>
              <span className={`gd-amount ${cf.type === 'DEPOSIT' ? 'gd-good' : 'gd-bad'}`}>
                {cf.type === 'DEPOSIT' ? '+' : '-'}
                {formatCurrency(cf.amount, currency)}
              </span>
              <button type="button" className="gd-ledger-del" onClick={() => handleDelete(cf.id)} aria-label="입출금 기록 삭제">
                삭제
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="gd-empty">아직 입출금 기록이 없습니다.</p>
      )}

      <form onSubmit={handleCreate} className="gd-form-row">
        <div className="gd-field">
          <label>날짜</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="gd-field">
          <label>구분</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'DEPOSIT' | 'WITHDRAWAL')}>
            <option value="DEPOSIT">입금</option>
            <option value="WITHDRAWAL">출금</option>
          </select>
        </div>
        <div className="gd-field">
          <label>금액</label>
          <input
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="예: 4000000"
            required
            style={{ width: '9rem' }}
          />
        </div>
        <div className="gd-field">
          <label>메모(선택)</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 정기 적립"
            style={{ width: '10rem' }}
          />
        </div>
        <button type="submit" className="gd-submit" disabled={submitting || !date || !amount}>
          {submitting ? '추가 중...' : '추가'}
        </button>
      </form>
    </div>
  );
}
