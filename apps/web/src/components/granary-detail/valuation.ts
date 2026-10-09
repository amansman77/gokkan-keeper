import type { CashFlow, Snapshot } from '../../lib/types';

export function snapshotPerformance(latest: Snapshot | undefined, previous: Snapshot | undefined, cashFlows: CashFlow[]) {
  const netCashFlowSincePrevious = latest && previous
    ? cashFlows.filter((flow) => flow.date > previous.date && flow.date <= latest.date)
      .reduce((sum, flow) => sum + (flow.type === 'DEPOSIT' ? flow.amount : -flow.amount), 0)
    : 0;
  const rawDelta = latest && previous ? latest.totalAmount - previous.totalAmount : null;
  const adjustedBase = previous ? previous.totalAmount + netCashFlowSincePrevious : null;
  const performanceDelta = latest && adjustedBase !== null ? latest.totalAmount - adjustedBase : null;
  const performancePct = performanceDelta !== null && adjustedBase ? (performanceDelta / adjustedBase) * 100 : null;
  return { rawDelta, performanceDelta, performancePct, netCashFlowSincePrevious, hasCashFlowInPeriod: netCashFlowSincePrevious !== 0 };
}
