import { formatCurrency, getPositionMarketValue } from '@gokkan-keeper/shared';
import { useState } from 'react';
import type { GranaryWithLatestSnapshot, Position } from '../../lib/types';
import { PositionRow } from './PositionRow';
import { SectionRow } from './SectionRow';

interface Props {
  granary: GranaryWithLatestSnapshot;
  positions: Position[];
  onDelete: (id: string) => Promise<void>;
}
export function GranaryPositions({ granary, positions, onDelete }: Props) {
  const [positionsCollapsed, setPositionsCollapsed] = useState(true);
  const [expandedIndicators, setExpandedIndicators] = useState<Set<string>>(new Set());
  const positionsTotalValue = positions.reduce((sum, p) => sum + (getPositionMarketValue(p) ?? 0), 0);
  const positionsUpCount = positions.filter((p) => (p.currentPriceChangeRate ?? 0) > 0).length;
  const positionsDownCount = positions.filter((p) => (p.currentPriceChangeRate ?? 0) < 0).length;
  return (
    <div>
      <SectionRow
        title="포지션"
        count={positions.length}
        expanded={!positionsCollapsed}
        onToggle={() => setPositionsCollapsed((prev) => !prev)}
        summary={
          positions.length === 0 ? (
            <span className="text-ink-faint">없음</span>
          ) : (
            <>
              <span>
                평가액 <b className="text-ink font-semibold">{formatCurrency(positionsTotalValue, granary.currency)}</b>
              </span>
              {positionsUpCount > 0 && <span className="gk-up">▲ {positionsUpCount}종</span>}
              {positionsDownCount > 0 && <span className="gk-down">▼ {positionsDownCount}종</span>}
            </>
          )
        }
      />
      {!positionsCollapsed && (
        <>
          {positions.length === 0 ? (
            <p className="text-ink-faint text-center py-8">등록된 포지션이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="gk-table">
                <thead>
                  <tr className="text-left text-xs text-ink-faint border-b">
                    <th>종목</th>
                    <th className="gk-num">수량</th>
                    <th className="gk-num gk-hide-narrow">현재가</th>
                    <th className="gk-num">등락</th>
                    <th className="gk-num">평가액</th>
                    <th className="gk-num">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <PositionRow key={position.id} position={position} currency={granary.currency}
                      expanded={expandedIndicators.has(position.id)} onDelete={onDelete}
                      onToggle={() => setExpandedIndicators((prev) => {
                        const next = new Set(prev);
                        next.has(position.id) ? next.delete(position.id) : next.add(position.id);
                        return next;
                      })} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
