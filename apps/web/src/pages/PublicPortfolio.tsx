import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJudgmentDiaryEntries, getPublicPortfolio } from '../lib/api';
import { setSeo } from '../lib/seo';
import type { JudgmentDiaryEntry, PublicPortfolioWarning } from '../lib/types';
import type { PublicPortfolioEntryData } from '../lib/api';
import { UI_TERMS } from '../lib/terminology';

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatPriceSourceLabel(source: PublicPortfolioEntryData['currentPriceSource']): string | null {
  if (source === 'FSC_STOCK_PRICE_API') return '금융위 시세';
  if (source === 'YAHOO_FINANCE') return 'Yahoo Finance';
  return null;
}

export default function PublicPortfolio() {
  const [portfolio, setPortfolio] = useState<PublicPortfolioEntryData[]>([]);
  const [warnings, setWarnings] = useState<PublicPortfolioWarning[]>([]);
  const [recentEntries, setRecentEntries] = useState<JudgmentDiaryEntry[]>([]);
  const [pricingMeta, setPricingMeta] = useState<{
    integratedCount: number;
    manualCount: number;
    latestAsOf: string | null;
  }>({
    integratedCount: 0,
    manualCount: 0,
    latestAsOf: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeo({
      title: `${UI_TERMS.publicArchive} 보기 | ${UI_TERMS.brandName}`,
      description: `추천이 아닌 기록. 판단과 배분, 결과를 ${UI_TERMS.publicArchive}에서 확인합니다.`,
    });
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [portfolioData, judgmentEntries] = await Promise.all([
          getPublicPortfolio(),
          getJudgmentDiaryEntries({ limit: 3 }),
        ]);
        setPortfolio(portfolioData.data);
        setWarnings(portfolioData.meta.warnings);
        setPricingMeta(portfolioData.meta.pricing);
        setRecentEntries(judgmentEntries);
      } catch (err: any) {
        setError(err.message || '공개 포트폴리오 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const weightedReturn = useMemo(() => {
    const visible = portfolio.filter((item) => item.returnPercent !== null && item.allocationPercent !== null);
    if (visible.length === 0) return null;

    return visible.reduce((acc, item) => {
      const weight = (item.allocationPercent ?? 0) / 100;
      return acc + (item.returnPercent || 0) * weight;
    }, 0);
  }, [portfolio]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-ink-muted">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger-tint border border-danger rounded-md p-4">
        <p className="text-danger font-semibold mb-2">오류 발생</p>
        <p className="text-danger text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="bg-surface rounded-lg border border-line-soft p-6">
        <h1 className="text-3xl font-bold text-ink">{UI_TERMS.publicArchive}</h1>
        <p className="text-ink-muted mt-2">추천이 아닌 기록. 판단과 배분, 결과를 투명하게 남깁니다.</p>
      </section>

      <section className="bg-surface rounded-lg border border-line-soft p-6">
        <h2 className="text-xl font-semibold text-ink">현재 수익률 요약</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-md border border-line-soft p-4">
            <p className="text-xs text-ink-faint">공개 포지션 수</p>
            <p className="text-2xl font-bold text-ink mt-1">{portfolio.length}</p>
          </div>
          <div className="rounded-md border border-line-soft p-4">
            <p className="text-xs text-ink-faint">평균 가중 수익률</p>
            <p className={`text-2xl font-bold mt-1 ${weightedReturn !== null && weightedReturn < 0 ? 'text-loss' : 'text-gain'}`}>
              {formatPercent(weightedReturn)}
            </p>
          </div>
          <div className="rounded-md border border-line-soft p-4">
            <p className="text-xs text-ink-faint">연동 기준</p>
            <p className="text-sm text-ink-muted mt-1">
              {pricingMeta.integratedCount > 0
                ? `${pricingMeta.latestAsOf ? `${pricingMeta.latestAsOf} 기준 ` : ''}금융위/Yahoo Finance 시세 연동`
                : '공개 포지션 평가금액 기준 자동 계산'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-muted">
          <span className="rounded-full bg-gain-tint px-3 py-1 text-gain">
            자동 연동 {pricingMeta.integratedCount}건
          </span>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-ink-muted">
            수동 입력 {pricingMeta.manualCount}건
          </span>
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="bg-flow-tint border border-flow rounded-lg p-4">
          <h2 className="text-sm font-semibold text-flow">데이터 경고</h2>
          <ul className="mt-2 text-sm text-flow list-disc pl-5">
            {warnings.map((warning) => (
              <li key={`${warning.positionId}-${warning.message}`}>
                {warning.symbol}: {warning.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-surface rounded-lg border border-line-soft p-6 overflow-x-auto">
        <h2 className="text-xl font-semibold text-ink">{UI_TERMS.publicPortfolio} 비중</h2>
        {portfolio.length === 0 ? (
          <p className="text-ink-faint mt-4">아직 공개된 포지션이 없습니다.</p>
        ) : (
          <table className="w-full mt-4 min-w-[720px]">
            <thead>
              <tr className="text-left text-sm text-ink-faint border-b">
                <th className="pb-2">Symbol</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Allocation</th>
                <th className="pb-2">Return</th>
                <th className="pb-2">Pricing</th>
                <th className="pb-2">Thesis</th>
                <th className="pb-2">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((item) => (
                <tr key={`${item.symbol}-${item.name}`} className="border-b last:border-b-0">
                  <td className="py-3 text-sm font-medium text-ink">{item.symbol}</td>
                  <td className="py-3 text-sm text-ink">{item.name}</td>
                  <td className="py-3 text-sm text-ink">{item.allocationPercent !== null ? `${item.allocationPercent.toFixed(2)}%` : '—'}</td>
                  <td className={`py-3 text-sm font-medium ${item.returnPercent !== null && item.returnPercent < 0 ? 'text-loss' : 'text-gain'}`}>
                    {formatPercent(item.returnPercent)}
                    {item.isEstimatedReturn ? <span className="text-xs text-ink-faint ml-1" title="avgCost와 currentValue로 추정된 값">* </span> : null}
                  </td>
                  <td className="py-3 text-sm text-ink-muted">
                    {item.currentPriceSource === 'FSC_STOCK_PRICE_API' || item.currentPriceSource === 'YAHOO_FINANCE' ? (
                      <div>
                        <p className="font-medium text-accent">{formatPriceSourceLabel(item.currentPriceSource)}</p>
                        <p className="text-xs text-ink-faint">
                          {item.currentPriceAsOf || '-'}
                          {item.currentUnitPrice !== null && item.currentUnitPrice !== undefined
                            ? ` · ${item.currentUnitPrice.toLocaleString()}`
                            : ''}
                        </p>
                      </div>
                    ) : item.currentPriceSource === 'MANUAL' ? (
                      <span className="text-ink-faint">수동 입력</span>
                    ) : (
                      <span className="text-ink-faint">-</span>
                    )}
                  </td>
                  <td className="py-3 text-sm text-ink-muted">{item.thesis || '-'}</td>
                  <td className="py-3 text-sm text-ink-muted">{item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-flow-tint border border-flow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-flow">유의 사항</h2>
        <p className="text-sm text-flow mt-2">이 공개 포트폴리오는 기록의 투명성을 위해 공유합니다.</p>
        <p className="text-sm text-flow">금융 자문이나 투자 권유가 아닙니다.</p>
        <p className="text-sm text-flow">모든 투자 판단과 결정의 책임은 본인에게 있습니다.</p>
      </section>

      <section className="bg-surface rounded-lg border border-line-soft p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-ink">최근 판단일지</h2>
          <Link to="/judgment-diary" className="text-sm font-medium text-accent hover:underline">
            전체 판단일지 보기
          </Link>
        </div>
        {recentEntries.length === 0 ? (
          <p className="mt-4 text-sm text-ink-faint">공개된 판단일지가 아직 없습니다.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentEntries.map((entry) => (
              <li key={entry.id}>
                <Link to={`/judgment-diary/${entry.id}`} className="text-sm text-ink hover:text-accent-ink hover:underline">
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-accent rounded-lg p-6 text-accent-contrast">
        <h2 className="text-xl font-semibold">구조 점검이 필요하신가요?</h2>
        <p className="mt-2 text-sm text-accent-contrast">무료 1회 구조 점검 요청을 통해 현재 포트폴리오의 중장기 기준을 점검할 수 있습니다.</p>
        <Link to="/consulting" className="mt-4 inline-flex items-center rounded-md bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2">
          무료 구조 점검 요청하기
        </Link>
      </section>
    </div>
  );
}
