import { useEffect, useState } from 'react';
import { submitConsultingRequest } from '../lib/api';
import { setSeo } from '../lib/seo';

export default function Consulting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    portfolioSizeRange: '',
    currentConcern: '',
    riskTolerance: '',
    investmentHorizon: '',
    discordHandle: '',
  });

  useEffect(() => {
    setSeo({
      title: '무료 구조 점검 요청 | 곶간지기',
      description: '포트폴리오 구조 점검을 위한 무료 1회 요청 폼',
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRequestId(null);

    try {
      const result = await submitConsultingRequest({
        email: form.email,
        portfolioSizeRange: form.portfolioSizeRange || null,
        currentConcern: form.currentConcern,
        riskTolerance: form.riskTolerance,
        investmentHorizon: form.investmentHorizon,
        discordHandle: form.discordHandle || null,
      });
      setRequestId(result.requestId);
      setForm({
        email: '',
        portfolioSizeRange: '',
        currentConcern: '',
        riskTolerance: '',
        investmentHorizon: '',
        discordHandle: '',
      });
    } catch (err: any) {
      setError(err.message || '요청 전송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-bold text-slate-900">무료 구조 점검 요청</h1>
      <p className="mt-2 text-sm text-slate-600">중장기 포트폴리오 구조 중심으로 무료 1회 점검을 제공합니다.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Portfolio Size Range (optional)</label>
            <input
              type="text"
              value={form.portfolioSizeRange}
              onChange={(e) => setForm({ ...form, portfolioSizeRange: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="예: 5천만~1억"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Risk Tolerance</label>
            <input
              type="text"
              required
              value={form.riskTolerance}
              onChange={(e) => setForm({ ...form, riskTolerance: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="예: 중립"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Investment Horizon</label>
            <input
              type="text"
              required
              value={form.investmentHorizon}
              onChange={(e) => setForm({ ...form, investmentHorizon: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="예: 3년+"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Discord Handle (optional)</label>
          <input
            type="text"
            value={form.discordHandle}
            onChange={(e) => setForm({ ...form, discordHandle: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="예: username"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Current Concern</label>
          <textarea
            required
            rows={4}
            value={form.currentConcern}
            onChange={(e) => setForm({ ...form, currentConcern: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="현재 고민을 구체적으로 작성해 주세요."
          />
        </div>

        {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        {requestId ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            요청이 접수되었습니다. Request ID: {requestId}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? '전송 중...' : '무료 구조 점검 요청 보내기'}
        </button>
      </form>
    </div>
  );
}
