import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { deletePosition, getCashFlows, getGranary, getGranaryExport, getPositions, getSnapshots } from '../lib/api';
import type { CashFlow, GranaryWithLatestSnapshot, Snapshot, Position } from '../lib/types';
import { formatCurrency, formatDate, getPositionMarketValue } from '@gokkan-keeper/shared';
import TechnicalIndicators from '../components/TechnicalIndicators';
import CashFlowManager from '../components/CashFlowManager';
import Sparkline from '../components/Sparkline';
import GranaryAddMenu from '../components/GranaryAddMenu';

const SNAPSHOT_PAGE_SIZE = 10;

interface SectionRowProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  /** Shown while collapsed as well as expanded, so folding a section away
   *  never costs the reader the headline figure it contains. */
  summary: React.ReactNode;
}

function SectionRow({ title, count, expanded, onToggle, summary }: SectionRowProps) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={expanded} className="gk-section-row">
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`gk-chevron ${expanded ? 'gk-chevron-open' : ''}`}>
        <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="gk-section-row-title">
        {title}
        {count > 0 && <span className="gk-chip gk-chip-count">{count}</span>}
      </span>
      <span className="gk-section-row-summary">{summary}</span>
    </button>
  );
}

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
  const [cashFlowsCollapsed, setCashFlowsCollapsed] = useState(true);
  const [visibleSnapshotCount, setVisibleSnapshotCount] = useState(SNAPSHOT_PAGE_SIZE);
  const [chartWidth, setChartWidth] = useState(720);
  const chartResizeObserverRef = useRef<ResizeObserver | null>(null);

  // The trend chart fills whatever width its card actually has, instead of a fixed size that
  // leaves a large blank gap on wide screens (or forces a scrollbar on narrow ones). A callback
  // ref (rather than useEffect + useRef) because the container only exists once snapshots have
  // loaded — a mount-time effect would run before that div exists and never observe anything.
  const chartContainerRef = useCallback((el: HTMLDivElement | null) => {
    chartResizeObserverRef.current?.disconnect();
    chartResizeObserverRef.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setChartWidth(Math.max(240, Math.floor(width)));
    });
    observer.observe(el);
    chartResizeObserverRef.current = observer;
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

  // Figures shown on the collapsed section rows.
  const positionsTotalValue = useMemo(
    () => positions.reduce((sum, p) => sum + (getPositionMarketValue(p) ?? 0), 0),
    [positions],
  );
  const positionsUpCount = useMemo(
    () => positions.filter((p) => (p.currentPriceChangeRate ?? 0) > 0).length,
    [positions],
  );
  const positionsDownCount = useMemo(
    () => positions.filter((p) => (p.currentPriceChangeRate ?? 0) < 0).length,
    [positions],
  );
  const netCashFlowTotal = useMemo(
    () => cashFlows.reduce((sum, cf) => sum + (cf.type === 'DEPOSIT' ? cf.amount : -cf.amount), 0),
    [cashFlows],
  );

  const reloadCashFlows = useCallback(async () => {
    if (!id) return;
    setCashFlows(await getCashFlows(id));
  }, [id]);

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
    <div className="space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-2 rounded-md transition-colors"
            aria-label="대시보드로 돌아가기"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="w-4 h-4 shrink-0 text-ink-faint"
            >
              <path
                d="M10 3.5 5.5 8 10 12.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>대시보드</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadJson}
              disabled={downloading}
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-ink-muted border border-line rounded-md hover:bg-surface-2 disabled:opacity-60 transition-colors"
            >
              {downloading ? '다운로드 중...' : 'JSON 다운로드'}
            </button>
            <Link
              to={`/granaries/${granary.id}/edit`}
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-accent border border-accent rounded-md hover:bg-accent-tint transition-colors"
            >
              수정
            </Link>
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight break-keep">{granary.name}</h1>
          <p className="text-ink-muted text-sm mt-1">{granary.purpose} · {granary.currency}</p>
        </div>
      </div>

      {/* 평가금액 + 추이: 가장 자주 확인하는 정보라 항상 펼쳐진 채로 맨 위에 둔다. */}
      <div className="bg-surface rounded-lg shadow p-4 sm:p-6">
        {latest ? (
          <div className="min-w-0 space-y-4">
            <div className="min-w-0">
              <p className="gk-meta text-sm">{formatDate(latest.date)} 기준 평가금액</p>
              <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                <span className="text-2xl sm:text-3xl font-bold text-ink tabular-nums break-all">
                  {formatCurrency(latest.totalAmount, granary.currency)}
                </span>
                {performanceDelta !== null && performancePct !== null && (
                  <span
                    className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                      performanceDelta > 0
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
              </div>
              {latest.availableBalance !== undefined && (
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
            {snapshotsAsc.length >= 2 && (
              <div className="min-w-0 w-full" ref={chartContainerRef}>
                <Sparkline
                  points={snapshotsAsc.map((s) => ({ date: s.date, value: s.totalAmount }))}
                  width={chartWidth}
                  height={72}
                  color="var(--gk-accent)"
                  formatValue={(v) => formatCurrency(v, granary.currency)}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-ink-faint">아직 스냅샷이 없습니다. 첫 스냅샷을 등록해 평가금액을 기록해보세요.</p>
        )}
      </div>

      {/* 세 기록을 카드 한 장으로 합치고, 접힌 줄마다 안쪽 내용을 요약해 보여준다.
          접어둔 상태에서도 곳간 상태가 파악되므로 접는 것이 정보 손실이 아니다. */}
      <div className="bg-surface rounded-lg shadow overflow-hidden divide-y divide-line-soft">
        {/* ── 포지션 ── */}
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
                      {positions.map((position) => {
                        const marketValue = getPositionMarketValue(position);
                        const rate = position.currentPriceChangeRate;
                        const isExpanded = expandedIndicators.has(position.id);
                        return (
                          <Fragment key={position.id}>
                            <tr className="border-b last:border-0 hover:bg-surface-2">
                              <td>
                                <div className="font-medium text-ink flex items-center gap-2">
                                  {position.name}
                                  {position.isPublic && (
                                    <span className="text-[10px] font-semibold text-accent bg-accent-tint px-1.5 py-0.5 rounded">
                                      공개
                                    </span>
                                  )}
                                </div>
                                <div className="gk-meta">
                                  {position.symbol}
                                  <span className="hidden sm:inline">
                                    {position.currentPriceAsOf ? ` · ${formatDate(position.currentPriceAsOf)}` : ''}
                                    {getPriceSourceLabel(position.currentPriceSource) ? ` · ${getPriceSourceLabel(position.currentPriceSource)}` : ''}
                                  </span>
                                </div>
                              </td>
                              <td className="gk-num">{position.quantity ?? '-'}</td>
                              <td className="gk-num gk-hide-narrow">
                                {position.currentUnitPrice !== null && position.currentUnitPrice !== undefined
                                  ? formatCurrency(position.currentUnitPrice, granary.currency)
                                  : '-'}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 gk-num font-medium ${
                                  rate === null || rate === undefined
                                    ? 'text-ink-faint'
                                    : rate > 0
                                    ? 'text-gain'
                                    : rate < 0
                                    ? 'text-loss'
                                    : 'text-ink-faint'
                                }`}
                              >
                                {rate === null || rate === undefined ? '-' : `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`}
                              </td>
                              <td className="gk-num font-semibold">
                                {marketValue !== null ? formatCurrency(marketValue, granary.currency) : '-'}
                              </td>
                              <td>
                                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
                                  <button
                                    onClick={() => setExpandedIndicators((prev) => {
                                      const next = new Set(prev);
                                      next.has(position.id) ? next.delete(position.id) : next.add(position.id);
                                      return next;
                                    })}
                                    className="text-ink-faint hover:text-ink-muted text-xs border border-line rounded px-1.5 py-0.5 whitespace-nowrap"
                                  >
                                    {isExpanded ? '지표 닫기' : '지표 보기'}
                                  </button>
                                  <Link to={`/positions/${position.id}/edit`} className="text-accent hover:underline text-xs whitespace-nowrap">
                                    수정
                                  </Link>
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm('포지션을 삭제하시겠습니까?')) return;
                                      await deletePosition(position.id);
                                      setPositions((prev) => prev.filter((p) => p.id !== position.id));
                                    }}
                                    className="text-danger hover:underline text-xs whitespace-nowrap"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="px-6 pb-4 bg-surface-2">
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
              )}
              <div className="gk-section-actions">
                <Link
                  to={`/positions/new?granaryId=${granary.id}`}
                  className="gk-btn gk-btn-primary"
                >
                  새 포지션 추가
                </Link>
              </div>
            </>
          )}
        </div>

        {/* ── 스냅샷 기록 ── */}
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
                      {snapshots.slice(0, visibleSnapshotCount).map((snapshot, index) => {
                        const prior = snapshots[index + 1];
                        const change = prior ? snapshot.totalAmount - prior.totalAmount : null;
                        const hadCashFlow = prior
                          ? cashFlows.some((cf) => cf.date > prior.date && cf.date <= snapshot.date)
                          : false;
                        return (
                          <tr key={snapshot.id} className="border-b last:border-0 hover:bg-surface-2">
                            <td className="whitespace-nowrap">{formatDate(snapshot.date)}</td>
                            <td className="gk-num font-semibold">
                              {formatCurrency(snapshot.totalAmount, granary.currency)}
                            </td>
                            <td
                              className={`px-2 sm:px-4 py-3 gk-num ${
                                change === null ? 'text-ink-faint' : change > 0 ? 'text-gain' : change < 0 ? 'text-loss' : 'text-ink-faint'
                              }`}
                            >
                              {change === null
                                ? '—'
                                : `${change > 0 ? '+' : ''}${formatCurrency(change, granary.currency)}`}
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
                                to={`/snapshots/${snapshot.id}/edit?granaryId=${granary.id}`}
                                className="text-accent hover:underline text-xs"
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
              <div className="gk-section-actions">
                <Link
                  to={`/snapshots/new?granaryId=${id}`}
                  className="gk-btn gk-btn-primary"
                >
                  새 스냅샷 추가
                </Link>
              </div>
            </>
          )}
        </div>

        {/* ── 입출금 기록 ── */}
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
            <CashFlowManager
              granaryId={granary.id}
              currency={granary.currency}
              cashFlows={cashFlows}
              onChanged={reloadCashFlows}
            />
          )}
        </div>
      </div>
      <GranaryAddMenu granaryId={granary.id} />
    </div>
  );
}
