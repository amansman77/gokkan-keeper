import { formatCurrency, formatDate } from '@gokkan-keeper/shared';
import { Link } from 'react-router-dom';
import type { CashFlow, Snapshot } from '../../lib/types';

interface Props {
  snapshot: Snapshot;
  prior: Snapshot | undefined;
  cashFlows: CashFlow[];
  currency: string;
  granaryId: string;
}
export function SnapshotRow({ snapshot, prior, cashFlows, currency, granaryId }: Props) {

  const change = prior ? snapshot.totalAmount - prior.totalAmount : null;
  const hadCashFlow = prior
    ? cashFlows.some((cf) => cf.date > prior.date && cf.date <= snapshot.date)
    : false;
  return (
    <tr key={snapshot.id} className="border-b last:border-0 hover:bg-surface-2">
      <td className="whitespace-nowrap">{formatDate(snapshot.date)}</td>
      <td className="gk-num font-semibold">
        {formatCurrency(snapshot.totalAmount, currency)}
      </td>
      <td
        className={`px-2 sm:px-4 py-3 gk-num ${change === null ? 'text-ink-faint' : change > 0 ? 'text-gain' : change < 0 ? 'text-loss' : 'text-ink-faint'
          }`}
      >
        {change === null
          ? '—'
          : `${change > 0 ? '+' : ''}${formatCurrency(change, currency)}`}
        {hadCashFlow && (
          <span
            className="ml-1.5 text-[10px] font-semibold text-flow bg-flow-tint px-1.5 py-0.5 rounded-full align-middle"
            title="이 구간에 입출금 기록이 있어요 — 변동액에 순수 매매 손익 외에 입출금 금액도 섞여 있습니다."
          >
            입출금
          </span>
        )}
      </td>
      <td className="text-ink-muted gk-hide-narrow">{snapshot.memo || ''}</td>
      <td className="gk-num">
        <Link
          to={`/snapshots/${snapshot.id}/edit?granaryId=${granaryId}`}
          className="text-accent hover:underline text-xs"
        >
          수정
        </Link>
      </td>
    </tr>
  );
}
