import { formatCurrency } from '@gokkan-keeper/shared';
import { useState } from 'react';
import type { CashFlow, GranaryWithLatestSnapshot } from '../../lib/types';
import CashFlowManager from '../CashFlowManager';
import { SectionRow } from './SectionRow';

interface Props {
  granary: GranaryWithLatestSnapshot;
  cashFlows: CashFlow[];
  reloadCashFlows: () => Promise<void>;
}
export function GranaryCashFlows({ granary, cashFlows, reloadCashFlows }: Props) {
  const [cashFlowsCollapsed, setCashFlowsCollapsed] = useState(true);
  const netCashFlowTotal = cashFlows.reduce((sum, cf) => sum + (cf.type === 'DEPOSIT' ? cf.amount : -cf.amount), 0);
  return (
    <div>
      <SectionRow
        title="입출금 기록"
        count={cashFlows.length}
        expanded={!cashFlowsCollapsed}
        onToggle={() => setCashFlowsCollapsed((prev) => !prev)}
        summary={
          cashFlows.length === 0 ? (
            <span className="text-ink-faint">없음</span>
          ) : (
            <span>
              {netCashFlowTotal >= 0 ? '순유입' : '순유출'}{' '}
              <b className="text-flow font-semibold">{formatCurrency(Math.abs(netCashFlowTotal), granary.currency)}</b>
            </span>
          )
        }
      />
      {!cashFlowsCollapsed && (
        <>
          <CashFlowManager
            currency={granary.currency}
            cashFlows={cashFlows}
            onChanged={reloadCashFlows}
          />
        </>
      )}
    </div>
  );
}
