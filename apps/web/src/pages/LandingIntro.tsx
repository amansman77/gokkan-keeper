import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPublicPortfolio } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { setSeo } from '../lib/seo';

interface TrackRecordData {
  publicPositionCount: number;
  weightedAverageReturn: number | null;
  snapshotReferenceText: string;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function PrimaryButton({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      {children}
    </Link>
  );
}

function SecondaryButton({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}

function StatCard({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-base leading-relaxed text-slate-700">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-700" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function HeroSection() {
  return (
    <section className="py-20">
      <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
        투자에서 가장 어려운 건
        <br />
        종목 선택이 아닙니다.
      </h1>
      <p className="mt-5 text-2xl font-semibold text-emerald-800">흔들리지 않는 구조입니다.</p>
      <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-slate-700">
        {'시장에 따라 사고 팔지만,\n구조 없이 버티는 투자는 오래가지 않습니다.\n\n곶간지기는\n중장기 포트폴리오를 유지하며\n시장 변동 속에서도 방향을 관리합니다.'}
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <PrimaryButton to="/archive">공개 포트폴리오 보기</PrimaryButton>
        <SecondaryButton to="/consulting">무료 구조 점검 받기</SecondaryButton>
      </div>
    </section>
  );
}

function EmpathySection() {
  return (
    <section className="border-t border-slate-200 py-20">
      <h2 className="text-2xl font-bold text-slate-900">이런 경험 있으신가요?</h2>
      <div className="mt-6">
        <BulletList
          items={[
            '시장이 오르면 뒤늦게 따라 붙고',
            '떨어지면 불안해서 정리하고',
            '1년이 지나도 계좌는 제자리',
          ]}
        />
      </div>
      <p className="mt-8 whitespace-pre-line text-lg leading-relaxed text-slate-800">
        {'이건 실력이 부족해서가 아닙니다.\n구조가 없기 때문입니다.'}
      </p>
    </section>
  );
}

function MethodSection() {
  return (
    <section className="border-t border-slate-200 py-20">
      <h2 className="text-2xl font-bold text-slate-900">곶간지기의 방식</h2>
      <div className="mt-6">
        <BulletList
          items={[
            '중장기 기준을 먼저 설정합니다',
            '비중을 관리합니다',
            '결과를 공개 기록합니다',
          ]}
        />
      </div>
      <p className="mt-8 whitespace-pre-line text-lg leading-relaxed text-slate-800">
        {'예측하지 않습니다.\n구조를 유지합니다.'}
      </p>
    </section>
  );
}

function TrackRecordSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrackRecordData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await getPublicPortfolio();

        if (cancelled) return;

        const visible = result.data.filter((item) => item.returnPercent !== null && item.allocationPercent !== null);
        const weightedAverageReturn =
          visible.length === 0
            ? null
            : visible.reduce((acc, item) => {
              const weight = (item.allocationPercent ?? 0) / 100;
              return acc + (item.returnPercent || 0) * weight;
            }, 0);

        setData({
          publicPositionCount: result.data.length,
          weightedAverageReturn,
          snapshotReferenceText: '최신 스냅샷 기반 비중/수익률 추정치',
        });
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || '공개 기록 정보를 불러오지 못했습니다.');
        setData({
          publicPositionCount: 0,
          weightedAverageReturn: null,
          snapshotReferenceText: '데이터를 불러오지 못했습니다.',
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const weightedReturnText = useMemo(() => formatPercent(data?.weightedAverageReturn ?? null), [data]);

  return (
    <section className="border-t border-slate-200 py-20">
      <h2 className="text-2xl font-bold text-slate-900">말이 아니라 기록입니다.</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="공개 판단 수"
          value={loading ? '로딩 중...' : String(data?.publicPositionCount ?? 0)}
        />
        <StatCard
          label="평균 가중 수익률"
          value={loading ? '로딩 중...' : weightedReturnText}
        />
        <StatCard
          label="기준"
          value={loading ? '로딩 중...' : '스냅샷 기반'}
          description={data?.snapshotReferenceText}
        />
      </div>
      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-8">
        <SecondaryButton to="/judgment-diary">전체 기록 확인하기</SecondaryButton>
      </div>
    </section>
  );
}

function DualCTASection() {
  const { authenticated } = useAuth();

  return (
    <section className="border-t border-slate-200 py-20">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-xl font-bold text-slate-900">직접 기록해보세요</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {'계좌 연결 없이\n판단과 비중만 기록할 수 있습니다.'}
          </p>
          <div className="mt-auto pt-6">
            <PrimaryButton to={authenticated ? '/dashboard' : '/login?next=/dashboard'}>
              나의 트랙레코드 만들기
            </PrimaryButton>
          </div>
        </div>

        <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-xl font-bold text-slate-900">구조 설계가 필요하다면</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {'곶간지기 매니저가\n포트폴리오 구조를 점검해드립니다.'}
          </p>
          <div className="mt-4 space-y-1 text-sm text-slate-700">
            <p>무료 1회</p>
            <p>중장기 중심</p>
            <p>단기 매매 조언 없음</p>
          </div>
          <div className="mt-auto pt-6">
            <SecondaryButton to="/consulting">무료 구조 점검 요청</SecondaryButton>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingIntro() {
  useEffect(() => {
    setSeo({
      title: '곶간지기 | 구조를 유지하는 투자 기록',
      description: '구조 없는 불안을 줄이고, 중장기 기준을 기록으로 관리하는 곶간지기 랜딩 페이지',
    });
  }, []);

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-[960px] px-5">
        <HeroSection />
        <EmpathySection />
        <MethodSection />
        <TrackRecordSummary />
        <DualCTASection />
      </div>
    </div>
  );
}
