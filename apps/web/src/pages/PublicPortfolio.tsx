import { useEffect, useMemo, useState } from 'react';
import { getPublicPortfolio, submitConsultingRequest } from '../lib/api';
import { setSeo } from '../lib/seo';
import type { PublicPortfolioEntry, PublicPortfolioWarning } from '../lib/types';

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export default function PublicPortfolio() {
  const [portfolio, setPortfolio] = useState<PublicPortfolioEntry[]>([]);
  const [warnings, setWarnings] = useState<PublicPortfolioWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultingLoading, setConsultingLoading] = useState(false);
  const [consultingError, setConsultingError] = useState<string | null>(null);
  const [consultingRequestId, setConsultingRequestId] = useState<string | null>(null);
  const [consultingForm, setConsultingForm] = useState({
    email: '',
    portfolioSizeRange: '',
    currentConcern: '',
    riskTolerance: '',
    investmentHorizon: '',
    discordHandle: '',
  });

  useEffect(() => {
    setSeo({
      title: 'Public Portfolio | Gokkan Keeper',
      description: '가설-배분-추적-회고를 기록하는 공개 포트폴리오 아카이브',
    });
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const portfolioData = await getPublicPortfolio();
        setPortfolio(portfolioData.data);
        setWarnings(portfolioData.meta.warnings);
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

  async function onSubmitConsulting(e: React.FormEvent) {
    e.preventDefault();
    setConsultingError(null);
    setConsultingRequestId(null);
    setConsultingLoading(true);

    try {
      const result = await submitConsultingRequest({
        email: consultingForm.email,
        portfolioSizeRange: consultingForm.portfolioSizeRange || null,
        currentConcern: consultingForm.currentConcern,
        riskTolerance: consultingForm.riskTolerance,
        investmentHorizon: consultingForm.investmentHorizon,
        discordHandle: consultingForm.discordHandle || null,
      });
      setConsultingRequestId(result.requestId);
      setConsultingForm({
        email: '',
        portfolioSizeRange: '',
        currentConcern: '',
        riskTolerance: '',
        investmentHorizon: '',
        discordHandle: '',
      });
    } catch (err: any) {
      setConsultingError(err.message || '요청 전송에 실패했습니다.');
    } finally {
      setConsultingLoading(false);
    }
  }

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
        <h1 className="text-3xl font-bold text-gray-900">Public Judgment Archive</h1>
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
            <p className="text-xs text-gray-500">기준</p>
            <p className="text-sm text-gray-700 mt-1">최신 스냅샷 기반 비중/수익률 추정치</p>
          </div>
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
                <th className="pb-2">Granary</th>
                <th className="pb-2">Allocation</th>
                <th className="pb-2">Return</th>
                <th className="pb-2">Thesis</th>
                <th className="pb-2">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((item) => (
                <tr key={`${item.symbol}-${item.name}`} className="border-b last:border-b-0">
                  <td className="py-3 text-sm font-medium text-gray-900">{item.symbol}</td>
                  <td className="py-3 text-sm text-gray-800">{item.name}</td>
                  <td className="py-3 text-sm text-gray-700">{item.granaryName || '-'}</td>
                  <td className="py-3 text-sm text-gray-800">{item.allocationPercent !== null ? `${item.allocationPercent.toFixed(2)}%` : '—'}</td>
                  <td className={`py-3 text-sm font-medium ${item.returnPercent !== null && item.returnPercent < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {formatPercent(item.returnPercent)}
                    {item.isEstimatedReturn ? <span className="text-xs text-gray-500 ml-1" title="avgCost와 currentValue로 추정된 값">* </span> : null}
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
        <h2 className="text-xl font-semibold text-gray-900">Consulting</h2>
        <p className="text-sm text-gray-600 mt-1">아래 요청을 보내면 디스코드 컨설팅 채널에 개별 문의가 등록됩니다.</p>

        <form onSubmit={onSubmitConsulting} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={consultingForm.email}
                onChange={(e) => setConsultingForm({ ...consultingForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio Size Range (optional)</label>
              <input
                type="text"
                value={consultingForm.portfolioSizeRange}
                onChange={(e) => setConsultingForm({ ...consultingForm, portfolioSizeRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 5천만~1억"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Risk Tolerance</label>
              <input
                type="text"
                required
                value={consultingForm.riskTolerance}
                onChange={(e) => setConsultingForm({ ...consultingForm, riskTolerance: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 중립"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Investment Horizon</label>
              <input
                type="text"
                required
                value={consultingForm.investmentHorizon}
                onChange={(e) => setConsultingForm({ ...consultingForm, investmentHorizon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 3년+"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discord Handle (optional)</label>
            <input
              type="text"
              value={consultingForm.discordHandle}
              onChange={(e) => setConsultingForm({ ...consultingForm, discordHandle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Concern</label>
            <textarea
              required
              rows={4}
              value={consultingForm.currentConcern}
              onChange={(e) => setConsultingForm({ ...consultingForm, currentConcern: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="현재 고민을 구체적으로 작성해 주세요."
            />
          </div>

          {consultingError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {consultingError}
            </div>
          )}

          {consultingRequestId && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-sm text-emerald-700">
              요청이 접수되었습니다. Request ID: {consultingRequestId}
            </div>
          )}

          <button
            type="submit"
            disabled={consultingLoading}
            className="inline-flex items-center justify-center bg-blue-600 text-white px-5 py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {consultingLoading ? '전송 중...' : 'Request Portfolio Feedback'}
          </button>
        </form>
      </section>
    </div>
  );
}
