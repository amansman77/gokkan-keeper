import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { setSeo } from '../lib/seo';

const strategyDescriptions: Record<string, string> = {
  trend: '추세 전략 판단 모음 – 추세에 반응하는 태도와 원칙 기록',
  'cash-management': '현금 관리 판단 모음 – 대기와 비중 관리의 철학 기록',
  rebalancing: '리밸런싱 판단 모음 – 자산 비중 조정 기준 기록',
  'risk-control': '리스크 관리 판단 모음 – 손실 통제와 회복 기준 기록',
};

export default function JudgmentDiaryStrategyArchive() {
  const { strategy } = useParams<{ strategy: string }>();
  const description = strategy ? strategyDescriptions[strategy] : undefined;

  useEffect(() => {
    if (!strategy) return;
    setSeo({
      title: `${strategy} 전략 판단 모음 | 추세 투자자의 판단일지`,
      description:
        description ||
        '추세 투자자의 판단일지에서 전략별 태도를 모아보는 페이지입니다. 태그 기반 자동 생성 예정입니다.',
    });
  }, [strategy, description]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">전략별 판단 모음</h1>
        <p className="text-gray-600">
          {description || '전략 태그 기반 자동 생성 페이지입니다. 현재는 구조만 제공합니다.'}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-6 text-gray-600">
        태그 기반 자동 연결은 추후 확장 예정입니다.
      </div>
      <Link
        to="/judgment-diary"
        className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
      >
        전체 판단일지
      </Link>
    </div>
  );
}
