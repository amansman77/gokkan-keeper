import { useState } from 'react';
import { deleteCashFlow } from '../lib/api';
import type { CashFlow } from '../lib/types';
import { formatCurrency, formatDate } from '@gokkan-keeper/shared';

interface CashFlowManagerProps {
  currency: string;
  /** Owned by the parent, which needs the same records for the snapshot delta
   *  and the collapsed-row summary — so this component does not fetch them
   *  a second time. */
  cashFlows: CashFlow[];
  onChanged: () => void | Promise<void>;
}

/** Read/delete list. Adding happens on /cash-flows/new, reached from the same
 *  add menu as snapshots and positions. */
export default function CashFlowManager({ currency, cashFlows, onChanged }: CashFlowManagerProps) {
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      await deleteCashFlow(id);
      await onChanged();
    } catch (err: any) {
      setError(err.message || '입출금 기록 삭제에 실패했습니다.');
    }
  }

  return (
    <div className="border-t border-line-soft">
      <p className="px-4 sm:px-5 pt-4 text-xs text-ink-faint max-w-[62ch]">
        스냅샷 총액에는 매매로 생긴 평가손익뿐 아니라 이 곳간에 새로 넣거나 뺀 돈도 섞여 있어요. 여기 입출금을 기록해두면
        나중에 실제 투자 성과(시간가중수익률)를 원금 증가분과 분리해서 계산할 수 있어요.
      </p>

      {error && <p className="px-4 sm:px-5 pt-3 text-sm text-danger">{error}</p>}

      {cashFlows.length > 0 ? (
        <div className="divide-y divide-line-soft mt-3">
          {cashFlows.map((cf) => (
            <div key={cf.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
              <span className="text-sm text-ink-faint w-20 sm:w-24 shrink-0 tabular-nums">{formatDate(cf.date)}</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                  cf.type === 'DEPOSIT' ? 'bg-accent-tint text-accent-ink' : 'bg-flow-tint text-flow'
                }`}
              >
                {cf.type === 'DEPOSIT' ? '입금' : '출금'}
              </span>
              <span className="text-sm font-semibold flex-1 tabular-nums">
                {formatCurrency(cf.amount, currency)}
              </span>
              {cf.memo && <span className="text-xs text-ink-faint truncate max-w-[10rem] hidden sm:inline">{cf.memo}</span>}
              <button
                type="button"
                onClick={() => handleDelete(cf.id)}
                className="text-xs text-ink-faint hover:text-danger px-2 py-1 shrink-0"
                aria-label="입출금 기록 삭제"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 sm:px-5 py-4 text-sm text-ink-faint">아직 입출금 기록이 없습니다.</p>
      )}

    </div>
  );
}
