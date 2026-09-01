import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { deletePosition, getGranary, getGranaryExport, getPositions, getSnapshots } from '../lib/api';
import type { GranaryWithLatestSnapshot, Snapshot, Position } from '../lib/types';
import { formatCurrency, formatDate, getPositionMarketValue } from '@gokkan-keeper/shared';
import TechnicalIndicators from '../components/TechnicalIndicators';
import CashFlowManager from '../components/CashFlowManager';
import './GranaryDetail.css';

function interpolateTotalAt(snapsAsc: Snapshot[], targetTime: number): number {
  if (snapsAsc.length === 0) return 0;
  const first = new Date(snapsAsc[0].date).getTime();
  const last = new Date(snapsAsc[snapsAsc.length - 1].date).getTime();
  if (targetTime <= first) return snapsAsc[0].totalAmount;
  if (targetTime >= last) return snapsAsc[snapsAsc.length - 1].totalAmount;
  for (let i = 0; i < snapsAsc.length - 1; i++) {
    const t0 = new Date(snapsAsc[i].date).getTime();
    const t1 = new Date(snapsAsc[i + 1].date).getTime();
    if (targetTime >= t0 && targetTime <= t1) {
      const ratio = t1 === t0 ? 0 : (targetTime - t0) / (t1 - t0);
      return snapsAsc[i].totalAmount + ratio * (snapsAsc[i + 1].totalAmount - snapsAsc[i].totalAmount);
    }
  }
  return snapsAsc[snapsAsc.length - 1].totalAmount;
}

function TotalAssetChart({ snapshots, depositDates }: { snapshots: Snapshot[]; depositDates: string[] }) {
  const snapsAsc = useMemo(
    () => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots],
  );
  if (snapsAsc.length < 2) return null;

  const W = 640;
  const H = 200;
  const padTop = 26;
  const padBottom = 14;
  const padL = 4;
  const padR = 4;

  const times = snapsAsc.map((s) => new Date(s.date).getTime());
  const values = snapsAsc.map((s) => s.totalAmount);
  const minT = times[0];
  const maxT = times[times.length - 1];
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  const x = (t: number) => padL + (maxT === minT ? 0 : ((t - minT) / (maxT - minT)) * (W - padL - padR));
  const y = (v: number) =>
    padTop + (maxV === minV ? (H - padTop - padBottom) / 2 : (1 - (v - minV) / (maxV - minV)) * (H - padTop - padBottom));

  const linePath = snapsAsc.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(times[i]).toFixed(1)} ${y(s.totalAmount).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(maxT).toFixed(1)} ${H - padBottom} L ${x(minT).toFixed(1)} ${H - padBottom} Z`;

  const lastX = x(maxT);
  const lastY = y(values[values.length - 1]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="총자산 추이">
      <defs>
        <linearGradient id="gdAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gd-accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--gd-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[minV, (minV + maxV) / 2, maxV].map((v) => (
        <line key={v} x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--gd-hairline)" strokeWidth={1} />
      ))}
      <path d={areaPath} fill="url(#gdAreaFill)" />
      <path d={linePath} fill="none" stroke="var(--gd-accent)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
      {depositDates.map((d) => {
        const t = new Date(d).getTime();
        if (t < minT || t > maxT) return null;
        const dx = x(t);
        const dy = y(interpolateTotalAt(snapsAsc, t));
        return (
          <g key={d}>
            <line x1={dx} y1={dy - 20} x2={dx} y2={dy - 6} stroke="var(--gd-indigo)" strokeWidth={1} strokeDasharray="2,3" />
            <circle cx={dx} cy={dy} r={3.5} fill="var(--gd-indigo)" />
          </g>
        );
      })}
      <circle cx={lastX} cy={lastY} r={4.5} fill="var(--gd-accent)" />
    </svg>
  );
}

export default function GranaryDetail() {
  const { id } = useParams<{ id: string }>();
  const [granary, setGranary] = useState<GranaryWithLatestSnapshot | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [expandedIndicators, setExpandedIndicators] = useState<Set<string>>(new Set());
  const [positionsCollapsed, setPositionsCollapsed] = useState(true);
  const [snapshotsCollapsed, setSnapshotsCollapsed] = useState(true);
  const [depositDates, setDepositDates] = useState<string[]>([]);

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
        const [granaryData, snapshotsData, positionsData] = await Promise.all([
          getGranary(granaryId),
          getSnapshots(granaryId),
          getPositions(granaryId),
        ]);
        setGranary(granaryData);
        setSnapshots(snapshotsData);
        setPositions(positionsData);
      } catch (err: any) {
        setError(err.message || '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const sortedPositions = useMemo(
    () => [...positions].sort((a, b) => (getPositionMarketValue(b) ?? 0) - (getPositionMarketValue(a) ?? 0)),
    [positions],
  );

  const snapshotsAsc = useMemo(() => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)), [snapshots]);
  const earliestSnapshot = snapshotsAsc[0];
  const latestSnapshot = snapshotsAsc[snapshotsAsc.length - 1];
  const deltaPercent =
    earliestSnapshot && latestSnapshot && earliestSnapshot.totalAmount > 0
      ? ((latestSnapshot.totalAmount - earliestSnapshot.totalAmount) / earliestSnapshot.totalAmount) * 100
      : null;

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

  const recentSnapshots = snapshotsAsc.slice(-6).reverse();
  const maxSnapshotTotal = snapshotsAsc.length > 0 ? Math.max(...snapshotsAsc.map((s) => s.totalAmount)) : 0;
  const maxPositionValue = sortedPositions.length > 0 ? Math.max(...sortedPositions.map((p) => getPositionMarketValue(p) ?? 0), 1) : 1;

  return (
    <div className="gd">
      <Link to="/dashboard" className="gd-crumb">
        ← 대시보드로 돌아가기
      </Link>

      <div className="gd-masthead">
        <div>
          <h1 className="gd-serif">{granary.name}</h1>
          <div className="gd-meta">
            <span className="gd-chip gd-purpose">{granary.purpose}</span>
            <span className="gd-chip gd-currency">{granary.currency}</span>
          </div>
        </div>
        <div className="gd-actions">
          <button onClick={handleDownloadJson} disabled={downloading} className="gd-btn">
            {downloading ? '다운로드 중...' : 'JSON 다운로드'}
          </button>
          <Link to={`/granaries/${granary.id}/edit`} className="gd-btn gd-primary">
            수정
          </Link>
        </div>
      </div>

      {latestSnapshot && (
        <div className="gd-hero">
          <div>
            <div className="gd-eyebrow">총평가금액</div>
            <div className="gd-hero-amount gd-serif">{formatCurrency(latestSnapshot.totalAmount, granary.currency)}</div>
            <div className="gd-hero-asof">
              {formatDate(latestSnapshot.date)} 스냅샷 기준
              {latestSnapshot.availableBalance !== undefined && ` · 예수금 ${formatCurrency(latestSnapshot.availableBalance, granary.currency)}`}
            </div>
            {deltaPercent !== null && (
              <div className="gd-delta-row">
                <span className={`gd-delta-pill ${deltaPercent >= 0 ? 'gd-good' : 'gd-bad'}`}>
                  {deltaPercent >= 0 ? '+' : ''}
                  {deltaPercent.toFixed(1)}%
                  <span className="gd-label">{formatDate(earliestSnapshot.date)} 대비 · 예수금 포함</span>
                </span>
              </div>
            )}
          </div>
          <div className="gd-chart-wrap">
            <TotalAssetChart snapshots={snapshotsAsc} depositDates={depositDates} />
            {snapshotsAsc.length >= 2 && (
              <div className="gd-chart-caption">
                <span>{formatDate(earliestSnapshot.date)}</span>
                <span>{formatDate(latestSnapshot.date)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="gd-section">
        <div className="gd-section-head">
          <button type="button" className="gd-section-title-btn" onClick={() => setPositionsCollapsed((prev) => !prev)}>
            <div className="gd-eyebrow">보유종목</div>
            <div className="gd-section-title">
              <span className="gd-caret">{positionsCollapsed ? '▶' : '▼'}</span>
              포지션
              {positions.length > 0 && <span className="gd-count">({positions.length})</span>}
            </div>
          </button>
          <Link to={`/positions/new?granaryId=${granary.id}`} className="gd-add-link">
            + 새 포지션 추가
          </Link>
        </div>

        {!positionsCollapsed && (
          positions.length === 0 ? (
            <p className="gd-empty">등록된 포지션이 없습니다.</p>
          ) : (
            <div className="gd-list">
              {sortedPositions.map((position) => {
                const marketValue = getPositionMarketValue(position);
                const barPct = marketValue ? (marketValue / maxPositionValue) * 100 : 0;
                return (
                  <div key={position.id} className="gd-position-row">
                    <div>
                      <div className="gd-name">{position.name} ({position.symbol})</div>
                      <div className="gd-sub">
                        <span className="gd-ticker">
                          {position.currentUnitPrice !== null && position.currentUnitPrice !== undefined
                            ? formatCurrency(position.currentUnitPrice, granary.currency)
                            : '-'}
                          {position.currentPriceAsOf ? ` · ${formatDate(position.currentPriceAsOf)}` : ''}
                          {getPriceSourceLabel(position.currentPriceSource) ? ` · ${getPriceSourceLabel(position.currentPriceSource)}` : ''}
                        </span>
                        {position.isPublic && position.publicThesis && (
                          <span className="gd-thesis-tag">{position.publicThesis}</span>
                        )}
                      </div>
                      <div className="gd-actions-row">
                        <button
                          onClick={() => setExpandedIndicators((prev) => {
                            const next = new Set(prev);
                            next.has(position.id) ? next.delete(position.id) : next.add(position.id);
                            return next;
                          })}
                        >
                          {expandedIndicators.has(position.id) ? '지표 닫기' : '지표 보기'}
                        </button>
                        <Link to={`/positions/${position.id}/edit`}>수정</Link>
                        <button
                          className="gd-danger"
                          onClick={async () => {
                            if (!window.confirm('포지션을 삭제하시겠습니까?')) return;
                            await deletePosition(position.id);
                            setPositions((prev) => prev.filter((p) => p.id !== position.id));
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <div className="gd-weight-col">
                      <div className="gd-weight-bar-track">
                        <div className="gd-weight-bar-fill" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    <div className="gd-value-cell">
                      <div className="gd-amount">{marketValue !== null ? formatCurrency(marketValue, granary.currency) : '-'}</div>
                      {position.currentPriceChangeRate !== null && position.currentPriceChangeRate !== undefined && (
                        <div className={`gd-change ${position.currentPriceChangeRate > 0 ? 'gd-up' : 'gd-down'}`}>
                          {position.currentPriceChangeRate > 0 ? '+' : ''}
                          {position.currentPriceChangeRate.toFixed(2)}%
                        </div>
                      )}
                    </div>
                    {expandedIndicators.has(position.id) && (
                      <div className="gd-indicator-wrap">
                        <TechnicalIndicators symbol={position.symbol} market={position.market} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <CashFlowManager granaryId={granary.id} currency={granary.currency} onDepositDatesChange={setDepositDates} />

      <div className="gd-section">
        <div className="gd-section-head">
          <button type="button" className="gd-section-title-btn" onClick={() => setSnapshotsCollapsed((prev) => !prev)}>
            <div className="gd-eyebrow">스냅샷 기록</div>
            <div className="gd-section-title">
              <span className="gd-caret">{snapshotsCollapsed ? '▶' : '▼'}</span>
              전체 기록
              {snapshots.length > 0 && <span className="gd-count">({snapshots.length})</span>}
            </div>
          </button>
          <Link to={`/snapshots/new?granaryId=${id}`} className="gd-add-link">
            + 새 스냅샷 추가
          </Link>
        </div>

        {!snapshotsCollapsed && (
          snapshots.length === 0 ? (
            <p className="gd-empty">아직 스냅샷이 없습니다.</p>
          ) : (
            <>
              <div className="gd-list">
                {recentSnapshots.map((snapshot) => {
                  const pct = maxSnapshotTotal > 0 ? (snapshot.totalAmount / maxSnapshotTotal) * 100 : 0;
                  return (
                    <div key={snapshot.id} className="gd-snap-row">
                      <span className="gd-date">{formatDate(snapshot.date)}</span>
                      <span className="gd-bar-track">
                        <span className="gd-bar-fill" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="gd-total">{formatCurrency(snapshot.totalAmount, granary.currency)}</span>
                      <Link to={`/snapshots/${snapshot.id}/edit?granaryId=${granary.id}`} className="gd-edit">
                        수정
                      </Link>
                    </div>
                  );
                })}
              </div>
              {snapshots.length > recentSnapshots.length && (
                <p className="gd-empty" style={{ paddingBottom: 0 }}>
                  최근 {recentSnapshots.length}건만 표시 중 (전체 {snapshots.length}건)
                </p>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
