import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJudgmentDiaryEntries, getPublicPortfolio } from '../lib/api';
import { setSeo } from '../lib/seo';
import type { JudgmentDiaryEntry, PublicPortfolioWarning } from '../lib/types';
import type { PublicPortfolioEntryData } from '../lib/api';

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
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
      title: '공개 기록 보기 | 곶간지기',
      description: '추천이 아닌 기록. 판단과 배분, 결과를 공개 아카이브로 확인합니다.',
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
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800 font-semibold mb-2">오류 발생</p>
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900">공개 기록 아카이브</h1>
        <p className="text-gray-600 mt-2">추천이 아닌 기록. 판단과 배분, 결과를 투명하게 남깁니다.</p>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Current Return Overview</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-md border border-gray-200 p-4">
            <p className="text-xs text-gray-500">공개 종목 수</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{portfolio.length}</p>
          </div>
          <div className="rounded-md border border-gray-200 p-4">
            <p className="text-xs text-gray-500">평균 가중 수익률</p>
            <p className={`text-2xl font-bold mt-1 ${weightedReturn !== null && weightedReturn < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {formatPercent(weightedReturn)}
            </p>
          </div>
          <div className="rounded-md border border-gray-200 p-4">
            <p className="text-xs text-gray-500">연동 기준</p>
            <p className="text-sm text-gray-700 mt-1">
              {pricingMeta.integratedCount > 0
                ? `금융위원회 시세 ${pricingMeta.latestAsOf ? `${pricingMeta.latestAsOf} 기준` : '연동'}`
                : '최신 스냅샷 기반 비중/수익률 추정치'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            자동 연동 {pricingMeta.integratedCount}건
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
            수동 fallback {pricingMeta.manualCount}건
          </span>
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-amber-900">Data Warnings</h2>
          <ul className="mt-2 text-sm text-amber-900 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={`${warning.positionId}-${warning.message}`}>
                {warning.symbol}: {warning.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white rounded-lg border border-gray-200 p-6 overflow-x-auto">
        <h2 className="text-xl font-semibold text-gray-900">Portfolio Allocation</h2>
        {portfolio.length === 0 ? (
          <p className="text-gray-500 mt-4">아직 공개된 포트폴리오 항목이 없습니다.</p>
        ) : (
          <table className="w-full mt-4 min-w-[720px]">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
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
                  <td className="py-3 text-sm font-medium text-gray-900">{item.symbol}</td>
                  <td className="py-3 text-sm text-gray-800">{item.name}</td>
                  <td className="py-3 text-sm text-gray-800">{item.allocationPercent !== null ? `${item.allocationPercent.toFixed(2)}%` : '—'}</td>
                  <td className={`py-3 text-sm font-medium ${item.returnPercent !== null && item.returnPercent < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {formatPercent(item.returnPercent)}
                    {item.isEstimatedReturn ? <span className="text-xs text-gray-500 ml-1" title="avgCost와 currentValue로 추정된 값">* </span> : null}
                  </td>
                  <td className="py-3 text-sm text-gray-700">
                    {item.currentPriceSource === 'FSC_STOCK_PRICE_API' ? (
                      <div>
                        <p className="font-medium text-emerald-700">금융위 시세</p>
                        <p className="text-xs text-gray-500">
                          {item.currentPriceAsOf || '-'}
                          {item.currentUnitPrice !== null && item.currentUnitPrice !== undefined
                            ? ` · ${item.currentUnitPrice.toLocaleString()}`
                            : ''}
                        </p>
                      </div>
                    ) : item.currentPriceSource === 'MANUAL' ? (
                      <span className="text-gray-500">수동 fallback</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 text-sm text-gray-700">{item.thesis || '-'}</td>
                  <td className="py-3 text-sm text-gray-600">{item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-amber-900">Disclaimer</h2>
        <p className="text-sm text-amber-900 mt-2">This portfolio is shared for research transparency purposes only.</p>
        <p className="text-sm text-amber-900">This is not financial advice or investment recommendation.</p>
        <p className="text-sm text-amber-900">All investment decisions are the responsibility of the individual.</p>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-900">최근 판단일지</h2>
          <Link to="/judgment-diary" className="text-sm font-medium text-blue-600 hover:underline">
            전체 판단일지 보기
          </Link>
        </div>
        {recentEntries.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">공개된 판단일지가 아직 없습니다.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentEntries.map((entry) => (
              <li key={entry.id}>
                <Link to={`/judgment-diary/${entry.id}`} className="text-sm text-gray-800 hover:text-blue-700 hover:underline">
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-slate-900 rounded-lg p-6 text-white">
        <h2 className="text-xl font-semibold">구조 점검이 필요하신가요?</h2>
        <p className="mt-2 text-sm text-slate-200">무료 1회 구조 점검 요청을 통해 현재 포트폴리오의 중장기 기준을 점검할 수 있습니다.</p>
        <Link to="/consulting" className="mt-4 inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
          무료 구조 점검 요청하기
        </Link>
      </section>
    </div>
  );
}
