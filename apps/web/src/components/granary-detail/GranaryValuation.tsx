import { formatCurrency, formatDate } from '@gokkan-keeper/shared';
import type { CashFlow, GranaryWithLatestSnapshot, Snapshot } from '../../lib/types';
import { snapshotPerformance } from './valuation';
import { ValuationChart } from './ValuationChart';

interface GranaryValuationProps {
  granary: GranaryWithLatestSnapshot;
  snapshots: Snapshot[];
  cashFlows: CashFlow[];
}

export function GranaryValuation({ granary, snapshots, cashFlows }: GranaryValuationProps) {
  const latest = granary.latestSnapshot;
  const { rawDelta, performanceDelta, performancePct, netCashFlowSincePrevious, hasCashFlowInPeriod } = snapshotPerformance(latest, snapshots[1], cashFlows);
  return (
    <div className="bg-surface rounded-lg shadow p-4 sm:p-6">
      {latest ? (
        <div className="min-w-0 space-y-4">
          <div className="min-w-0">
            <p className="gk-meta text-sm">{formatDate(latest.date)} 기준 평가금액</p>
            <div className="flex items-baseline gap-3 mt-1 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-ink tabular-nums break-all">
                {formatCurrency(latest.totalAmount, granary.currency)}
              </span>
              <PerformanceBadge delta={performanceDelta} percentage={performancePct} hasCashFlow={hasCashFlowInPeriod} />
            </div>
            {latest.availableBalance != null && (
              <p className="text-sm text-ink-muted mt-2">
                예수금 {formatCurrency(latest.availableBalance, granary.currency)}
              </p>
            )}
            {hasCashFlowInPeriod && rawDelta !== null && performanceDelta !== null && (
              <p className="gk-meta mt-1">
                이 구간 총 변동 {rawDelta > 0 ? '+' : ''}{formatCurrency(rawDelta, granary.currency)} =
                {' '}실질 {performanceDelta > 0 ? '+' : ''}{formatCurrency(performanceDelta, granary.currency)}
                {' '}+ 입출금 {netCashFlowSincePrevious > 0 ? '+' : ''}{formatCurrency(netCashFlowSincePrevious, granary.currency)}
              </p>
            )}
          </div>
          <ValuationChart snapshots={snapshots} currency={granary.currency} />
        </div>
      ) : (
        <p className="text-ink-faint">아직 스냅샷이 없습니다. 첫 스냅샷을 등록해 평가금액을 기록해보세요.</p>
      )}
    </div>
  );
}

interface PerformanceBadgeProps {
  delta: number | null;
  percentage: number | null;
  hasCashFlow: boolean;
}

function PerformanceBadge({ delta: performanceDelta, percentage: performancePct, hasCashFlow: hasCashFlowInPeriod }: PerformanceBadgeProps) {
  return <>
    {performanceDelta !== null && performancePct !== null && (
      <span
        className={`text-sm font-semibold px-2 py-0.5 rounded-full ${performanceDelta > 0
          ? 'bg-gain-tint text-gain'
          : performanceDelta < 0
            ? 'bg-loss-tint text-loss'
            : 'bg-surface-2 text-ink-faint'
          }`}
      >
        {performanceDelta > 0 ? '▲' : performanceDelta < 0 ? '▼' : '–'} {Math.abs(performancePct).toFixed(1)}%
        {hasCashFlowInPeriod ? ' (입출금 반영 실질)' : ' (직전 스냅샷 대비)'}
      </span>
    )}
  </>;
}
