import { Link, useParams } from 'react-router-dom';
import GranaryAddMenu from '../components/GranaryAddMenu';
import { GranaryCashFlows } from '../components/granary-detail/GranaryCashFlows';
import { GranaryHeader } from '../components/granary-detail/GranaryHeader';
import { GranaryPositions } from '../components/granary-detail/GranaryPositions';
import { GranarySnapshots } from '../components/granary-detail/GranarySnapshots';
import { GranaryValuation } from '../components/granary-detail/GranaryValuation';
import { useGranaryDetail } from '../components/granary-detail/useGranaryDetail';
import { deletePosition } from '../lib/api';

export default function GranaryDetail() {
  const { id } = useParams<{ id: string }>();
  const { granary, snapshots, positions, cashFlows, loading, error, setPositions, reloadCashFlows } = useGranaryDetail(id);
  if (loading) {
    return (
      <div className="gk-loading">
        <div className="text-ink-muted">로딩 중...</div>
      </div>
    );
  }

  if (error || !granary) {
    return (
      <div className="gk-alert">
        <p className="text-danger">{error || '곳간을 찾을 수 없습니다.'}</p>
        <Link to="/dashboard" className="text-accent hover:underline mt-2 inline-block">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const onDelete = async (positionId: string) => {
    await deletePosition(positionId);
    setPositions((prev) => prev.filter((position) => position.id !== positionId));
  };
  return (
    <div className="space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <GranaryHeader granary={granary} />
      <GranaryValuation granary={granary} snapshots={snapshots} cashFlows={cashFlows} />
      <div className="bg-surface rounded-lg shadow overflow-hidden divide-y divide-line-soft">
        <GranaryPositions granary={granary} positions={positions} onDelete={onDelete} />
        <GranarySnapshots granary={granary} snapshots={snapshots} cashFlows={cashFlows} />
        <GranaryCashFlows granary={granary} cashFlows={cashFlows} reloadCashFlows={reloadCashFlows} />
      </div>
      <GranaryAddMenu granaryId={granary.id} />
    </div>
  );
}
