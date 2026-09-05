import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { deletePosition, getCashFlows, getGranary, getGranaryExport, getPositions, getSnapshots } from '../lib/api';
import type { CashFlow, GranaryWithLatestSnapshot, Snapshot, Position } from '../lib/types';
import { formatCurrency, formatDate, getPositionMarketValue } from '@gokkan-keeper/shared';
import TechnicalIndicators from '../components/TechnicalIndicators';
import CashFlowManager from '../components/CashFlowManager';
import Sparkline from '../components/Sparkline';

const SNAPSHOT_PAGE_SIZE = 10;

export default function GranaryDetail() {
  const { id } = useParams<{ id: string }>();
  const [granary, setGranary] = useState<GranaryWithLatestSnapshot | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [expandedIndicators, setExpandedIndicators] = useState<Set<string>>(new Set());
  const [positionsCollapsed, setPositionsCollapsed] = useState(true);
  const [snapshotsCollapsed, setSnapshotsCollapsed] = useState(true);
  const [visibleSnapshotCount, setVisibleSnapshotCount] = useState(SNAPSHOT_PAGE_SIZE);
  const [chartWidth, setChartWidth] = useState(720);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  // The trend chart fills whatever width its card actually has, instead of a fixed size that
  // leaves a large blank gap on wide screens (or forces a scrollbar on narrow ones).
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setChartWidth(Math.max(240, Math.floor(width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!id) {
      setError('곳간 ID가 없습니다.');
      setLoading(false);
      return;
    }

    const granaryId = id; // Type narrowing

    async function loadData() {
      try {
        setLoading(true);
        const [granaryData, snapshotsData, positionsData, cashFlowsData] = await Promise.all([
          getGranary(granaryId),
          getSnapshots(granaryId),
          getPositions(granaryId),
          getCashFlows(granaryId),
        ]);
        setGranary(granaryData);
        setSnapshots(snapshotsData);
        setPositions(positionsData);
        setCashFlows(cashFlowsData);
      } catch (err: any) {
        setError(err.message || '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // Snapshots come back newest-first; the trend chart wants oldest-first.
  const snapshotsAsc = useMemo(() => [...snapshots].reverse(), [snapshots]);
  const previousSnapshot = snapshots[1];
  const latestSnapshot = snapshots[0];

  // Cash moved in/out between the two snapshots being compared — without this, a deposit or
  // withdrawal reads as investment performance in the delta below (the same conflation the
  // cash-flow ledger exists to untangle for TWR).
  const netCashFlowSincePrevious = useMemo(() => {
    if (!latestSnapshot || !previousSnapshot) return 0;
    return cashFlows
      .filter((cf) => cf.date > previousSnapshot.date && cf.date <= latestSnapshot.date)
      .reduce((sum, cf) => sum + (cf.type === 'DEPOSIT' ? cf.amount : -cf.amount), 0);
  }, [cashFlows, latestSnapshot, previousSnapshot]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error || !granary) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error || '곳간을 찾을 수 없습니다.'}</p>
        <Link to="/dashboard" className="text-blue-600 hover:underline mt-2 inline-block">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const handleDownloadJson = async () => {
    if (!granary) return;
    try {
      setDownloading(true);
      const payload = await getGranaryExport(granary.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = granary.name.replace(/\s+/g, '-').toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `granary-${safeName}-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'JSON 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const getPriceSourceLabel = (source: Position['currentPriceSource']) => {
    if (source === 'FSC_STOCK_PRICE_API') return '금융위원회 시세';
    if (source === 'YAHOO_FINANCE') return 'Yahoo Finance';
    return null;
  };

  const latest = granary.latestSnapshot;
  // Raw total change includes any deposit/withdrawal between the two snapshots.
  const rawDelta = latest && previousSnapshot ? latest.totalAmount - previousSnapshot.totalAmount : null;
  // Net out the cash flow so the headline number reflects investment performance, not funding.
  const adjustedBase = previousSnapshot ? previousSnapshot.totalAmount + netCashFlowSincePrevious : null;
  const performanceDelta =
    latest && adjustedBase !== null ? latest.totalAmount - adjustedBase : null;
  const performancePct =
    performanceDelta !== null && adjustedBase ? (performanceDelta / adjustedBase) * 100 : null;
  const hasCashFlowInPeriod = netCashFlowSincePrevious !== 0;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
          ← 대시보드로 돌아가기
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{granary.name}</h1>
            <p className="text-gray-600 mt-1">{granary.purpose} · {granary.currency}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadJson}
              disabled={downloading}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-60"
            >
              {downloading ? '다운로드 중...' : 'JSON 다운로드'}
            </button>
            <Link
              to={`/granaries/${granary.id}/edit`}
              className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
            >
              수정
            </Link>
          </div>
        </div>
      </div>

      {/* 평가금액 + 추이: 가장 자주 확인하는 정보라 항상 펼쳐진 채로 맨 위에 둔다. */}
      <div className="bg-white rounded-lg shadow p-6">
        {latest ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">{formatDate(latest.date)} 기준 평가금액</p>
                <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatCurrency(latest.totalAmount, granary.currency)}
                  </span>
                  {performanceDelta !== null && performancePct !== null && (
                    <span
                      className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                        performanceDelta > 0
                          ? 'bg-green-50 text-green-700'
                          : performanceDelta < 0
                          ? 'bg-red-50 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {performanceDelta > 0 ? '▲' : performanceDelta < 0 ? '▼' : '–'} {Math.abs(performancePct).toFixed(1)}%
                      {hasCashFlowInPeriod ? ' (입출금 반영 실질)' : ' (직전 스냅샷 대비)'}
                    </span>
                  )}
                </div>
                {latest.availableBalance !== undefined && (
                  <p className="text-sm text-gray-600 mt-2">
                    예수금 {formatCurrency(latest.availableBalance, granary.currency)}
                  </p>
                )}
                {hasCashFlowInPeriod && rawDelta !== null && performanceDelta !== null && (
                  <p className="text-xs text-gray-400 mt-1">
                    이 구간 총 변동 {rawDelta > 0 ? '+' : ''}{formatCurrency(rawDelta, granary.currency)} =
                    {' '}실질 {performanceDelta > 0 ? '+' : ''}{formatCurrency(performanceDelta, granary.currency)}
                    {' '}+ 입출금 {netCashFlowSincePrevious > 0 ? '+' : ''}{formatCurrency(netCashFlowSincePrevious, granary.currency)}
                  </p>
                )}
              </div>
              <Link
                to={`/snapshots/new?granaryId=${id}`}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
              >
                새 스냅샷 등록
              </Link>
            </div>
            {snapshotsAsc.length >= 2 && (
              <div className="mt-6 w-full" ref={chartContainerRef}>
                <Sparkline
                  points={snapshotsAsc.map((s) => ({ date: s.date, value: s.totalAmount }))}
                  width={chartWidth}
                  height={72}
                  color="#2563eb"
                  formatValue={(v) => formatCurrency(v, granary.currency)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-500">아직 스냅샷이 없습니다. 첫 스냅샷을 등록해 평가금액을 기록해보세요.</p>
            <Link
              to={`/snapshots/new?granaryId=${id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
            >
              새 스냅샷 등록
            </Link>
          </div>
        )}
      </div>

      {/* 포지션: 표 형태로 압축해서 한눈에 스캔되도록 하고, 기본은 접어둔다. */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex justify-between items-center p-6 pb-4">
          <button
            type="button"
            onClick={() => setPositionsCollapsed((prev) => !prev)}
            className="flex items-center gap-2 text-lg font-semibold text-gray-900"
          >
            <span className="text-gray-400 text-sm">{positionsCollapsed ? '▶' : '▼'}</span>
            포지션 {positions.length > 0 && <span className="text-sm text-gray-400 font-normal">({positions.length})</span>}
          </button>
          <Link
            to={`/positions/new?granaryId=${granary.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            새 포지션 추가
          </Link>
        </div>

        {!positionsCollapsed && (
          positions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">등록된 포지션이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="px-6 py-2 font-medium">종목</th>
                    <th className="px-6 py-2 font-medium text-right">수량</th>
                    <th className="px-6 py-2 font-medium text-right hidden sm:table-cell">현재가</th>
                    <th className="px-6 py-2 font-medium text-right">등락</th>
                    <th className="px-6 py-2 font-medium text-right">평가액</th>
                    <th className="px-6 py-2 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const marketValue = getPositionMarketValue(position);
                    const rate = position.currentPriceChangeRate;
                    const isExpanded = expandedIndicators.has(position.id);
                    return (
                      <Fragment key={position.id}>
                        <tr className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-6 py-3">
                            <div className="font-medium text-gray-900 flex items-center gap-2">
                              {position.name}
                              {position.isPublic && (
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                  공개
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">
                              {position.symbol}
                              <span className="hidden sm:inline">
                                {position.currentPriceAsOf ? ` · ${formatDate(position.currentPriceAsOf)}` : ''}
                                {getPriceSourceLabel(position.currentPriceSource) ? ` · ${getPriceSourceLabel(position.currentPriceSource)}` : ''}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums">{position.quantity ?? '-'}</td>
                          <td className="px-6 py-3 text-right tabular-nums hidden sm:table-cell">
                            {position.currentUnitPrice !== null && position.currentUnitPrice !== undefined
                              ? formatCurrency(position.currentUnitPrice, granary.currency)
                              : '-'}
                          </td>
                          <td
                            className={`px-6 py-3 text-right tabular-nums font-medium ${
                              rate === null || rate === undefined
                                ? 'text-gray-400'
                                : rate > 0
                                ? 'text-green-600'
                                : rate < 0
                                ? 'text-red-600'
                                : 'text-gray-500'
                            }`}
                          >
                            {rate === null || rate === undefined ? '-' : `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums font-semibold">
                            {marketValue !== null ? formatCurrency(marketValue, granary.currency) : '-'}
                          </td>
                          <td className="px-6 py-3 text-right whitespace-normal sm:whitespace-nowrap">
                            <button
                              onClick={() => setExpandedIndicators((prev) => {
                                const next = new Set(prev);
                                next.has(position.id) ? next.delete(position.id) : next.add(position.id);
                                return next;
                              })}
                              className="text-gray-500 hover:text-gray-700 text-xs border border-gray-300 rounded px-2 py-1 mr-2"
                            >
                              {isExpanded ? '지표 닫기' : '지표 보기'}
                            </button>
                            <Link to={`/positions/${position.id}/edit`} className="text-blue-600 hover:underline text-xs mr-2">
                              수정
                            </Link>
                            <button
                              onClick={async () => {
                                if (!window.confirm('포지션을 삭제하시겠습니까?')) return;
                                await deletePosition(position.id);
                                setPositions((prev) => prev.filter((p) => p.id !== position.id));
                              }}
                              className="text-red-600 hover:underline text-xs"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="px-6 pb-4 bg-gray-50">
                              <TechnicalIndicators symbol={position.symbol} market={position.market} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* 스냅샷 기록: 추이는 위에서 이미 확인했으니, 여기는 날짜별 정확한 숫자가 필요할 때만 펼쳐보는 상세 자료. */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <button
          type="button"
          onClick={() => setSnapshotsCollapsed((prev) => !prev)}
          className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 p-6 pb-4"
        >
          <span className="text-gray-400 text-sm">{snapshotsCollapsed ? '▶' : '▼'}</span>
          스냅샷 기록 {snapshots.length > 0 && <span className="text-sm text-gray-400 font-normal">({snapshots.length})</span>}
        </button>

        {!snapshotsCollapsed && (
          snapshots.length === 0 ? (
            <p className="text-gray-500 text-center py-8">아직 스냅샷이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="px-6 py-2 font-medium">날짜</th>
                    <th className="px-6 py-2 font-medium text-right">평가금액</th>
                    <th className="px-6 py-2 font-medium text-right">전기 대비</th>
                    <th className="px-6 py-2 font-medium hidden sm:table-cell">메모</th>
                    <th className="px-6 py-2 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.slice(0, visibleSnapshotCount).map((snapshot, index) => {
                    const prior = snapshots[index + 1];
                    const change = prior ? snapshot.totalAmount - prior.totalAmount : null;
                    const hadCashFlow = prior
                      ? cashFlows.some((cf) => cf.date > prior.date && cf.date <= snapshot.date)
                      : false;
                    return (
                      <tr key={snapshot.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-6 py-3 whitespace-nowrap">{formatDate(snapshot.date)}</td>
                        <td className="px-6 py-3 text-right tabular-nums font-semibold">
                          {formatCurrency(snapshot.totalAmount, granary.currency)}
                        </td>
                        <td
                          className={`px-6 py-3 text-right tabular-nums ${
                            change === null ? 'text-gray-400' : change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
                          }`}
                        >
                          {change === null
                            ? '—'
                            : `${change > 0 ? '+' : ''}${formatCurrency(change, granary.currency)}`}
                          {hadCashFlow && (
                            <span
                              className="ml-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full align-middle"
                              title="이 구간에 입출금 기록이 있어요 — 변동액에 순수 매매 손익 외에 입출금 금액도 섞여 있습니다."
                            >
                              입출금
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-gray-600 hidden sm:table-cell">{snapshot.memo || ''}</td>
                        <td className="px-6 py-3 text-right whitespace-nowrap">
                          <Link
                            to={`/snapshots/${snapshot.id}/edit?granaryId=${granary.id}`}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            수정
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleSnapshotCount < snapshots.length && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <button
                          type="button"
                          onClick={() => setVisibleSnapshotCount((n) => n + SNAPSHOT_PAGE_SIZE)}
                          className="w-full text-center py-3 text-sm text-blue-600 hover:bg-gray-50"
                        >
                          이전 {snapshots.length - visibleSnapshotCount}건 더 보기
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <CashFlowManager granaryId={granary.id} currency={granary.currency} />
    </div>
  );
}
