import { formatCurrency, formatDate } from '@gokkan-keeper/shared';
import { useState } from 'react';
import type { CashFlow, GranaryWithLatestSnapshot, Snapshot } from '../../lib/types';
import { SectionRow } from './SectionRow';
import { SnapshotRow } from './SnapshotRow';

const SNAPSHOT_PAGE_SIZE = 10;
interface Props {
  granary: GranaryWithLatestSnapshot;
  snapshots: Snapshot[];
  cashFlows: CashFlow[];
}
export function GranarySnapshots({ granary, snapshots, cashFlows }: Props) {
  const [snapshotsCollapsed, setSnapshotsCollapsed] = useState(true);
  const [visibleSnapshotCount, setVisibleSnapshotCount] = useState(SNAPSHOT_PAGE_SIZE);
  const latestSnapshot = snapshots[0];
  const rawDelta = granary.latestSnapshot && snapshots[1] ? granary.latestSnapshot.totalAmount - snapshots[1].totalAmount : null;
  return (
    <div>
      <SectionRow
        title="스냅샷 기록"
        count={snapshots.length}
        expanded={!snapshotsCollapsed}
        onToggle={() => setSnapshotsCollapsed((prev) => !prev)}
        summary={
          !latestSnapshot ? (
            <span className="text-ink-faint">없음</span>
          ) : (
            <>
              <span className="hidden sm:inline">
                최근 <b className="text-ink font-semibold">{formatDate(latestSnapshot.date)}</b>
              </span>
              {rawDelta !== null && (
                <span className={rawDelta > 0 ? 'gk-up' : rawDelta < 0 ? 'gk-down' : 'gk-flat'}>
                  {rawDelta > 0 ? '▲' : rawDelta < 0 ? '▼' : '–'} {formatCurrency(Math.abs(rawDelta), granary.currency)}
                </span>
              )}
            </>
          )
        }
      />
      {!snapshotsCollapsed && (
        <>
          {snapshots.length === 0 ? (
            <p className="text-ink-faint text-center py-8">아직 스냅샷이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="gk-table">
                <thead>
                  <tr className="text-left text-xs text-ink-faint border-b">
                    <th>날짜</th>
                    <th className="gk-num">평가금액</th>
                    <th className="gk-num">전기 대비</th>
                    <th className="gk-hide-narrow">메모</th>
                    <th className="gk-num">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.slice(0, visibleSnapshotCount).map((snapshot, index) => (
                    <SnapshotRow key={snapshot.id} snapshot={snapshot} prior={snapshots[index + 1]}
                      cashFlows={cashFlows} currency={granary.currency} granaryId={granary.id} />
                  ))}
                  {visibleSnapshotCount < snapshots.length && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <button
                          type="button"
                          onClick={() => setVisibleSnapshotCount((n) => n + SNAPSHOT_PAGE_SIZE)}
                          className="w-full text-center py-3 text-sm text-accent hover:bg-surface-2"
                        >
                          이전 {snapshots.length - visibleSnapshotCount}건 더 보기
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
