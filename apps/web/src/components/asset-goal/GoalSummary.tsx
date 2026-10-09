import {
  monthsSince,
  monthsUntilYearEnd,
  projectAssetValue,
  requiredMonthlyContribution,
  type AssetGoalPlan
} from '@gokkan-keeper/shared';

import { formatEok } from './model';
interface GoalSummaryProps {
  plan: AssetGoalPlan;
  total: number;
  hasUsd: boolean;
  usdKrw: number | null;
  excluded: string[];
}

export function GoalSummary({ plan, total, hasUsd, usdKrw, excluded }: GoalSummaryProps) {
  const drawdownFloor = total * (1 - plan.maxDrawdown);
  const paths = plan.baseline
    ? [
      { label: `기대 ${(plan.expectedAnnualReturn * 100).toFixed(0)}% 경로`, rate: plan.expectedAnnualReturn },
      ...(plan.targetAnnualReturn != null
        ? [{ label: `목표 ${(plan.targetAnnualReturn * 100).toFixed(0)}% 경로`, rate: plan.targetAnnualReturn }]
        : []),
    ].map(({ label, rate }) => {
      const expected = projectAssetValue(
        plan.baseline!.amount,
        plan.monthlyContribution,
        rate,
        monthsSince(plan.baseline!.date),
      );
      return { label, expected, gap: total - expected };
    })
    : [];

  return <>
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
      <span className="text-2xl font-bold text-ink">{formatEok(total)}원</span>
      <span className="gk-meta">
        {plan.excludedPurposes.length > 0 ? `곳간 합계(${plan.excludedPurposes.join(', ')} 제외)` : '전체 곳간 합계'}
        {hasUsd && (usdKrw ? ` · USD ${usdKrw.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원 환산` : ' · 환율 조회 실패로 USD 곳간 제외')}
        {excluded.length > 0 && ` · 환산 불가 제외: ${excluded.join(', ')}`}
      </span>
    </div>

    <div className="space-y-4">
      {plan.milestones.map((milestone) => {
        const months = monthsUntilYearEnd(milestone.year);
        const projected = projectAssetValue(total, plan.monthlyContribution, plan.expectedAnnualReturn, months);
        const required = requiredMonthlyContribution(total, milestone.amount, plan.expectedAnnualReturn, months);
        const progress = Math.min(1, total / milestone.amount);
        const onTrack = projected >= milestone.amount;
        return (
          <div key={`${milestone.year}-${milestone.amount}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
              <span className="font-medium text-ink">
                {milestone.year}년 말 {formatEok(milestone.amount)}원
              </span>
              <span className={`gk-chip ${onTrack ? 'gk-chip-accent' : 'gk-chip-count'}`}>
                {onTrack ? '달성 경로' : '부족'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${(progress * 100).toFixed(1)}%` }} />
            </div>
            <p className="gk-hint mt-1">
              {(progress * 100).toFixed(1)}% · {months}개월 남음 · 예상 {formatEok(projected)}원 · 필요 월 납입{' '}
              {required === 0 ? '없음' : `${formatEok(required)}원`}
            </p>
          </div>
        );
      })}
    </div>

    {plan.baseline && (
      <div className="mt-4 pt-3 border-t border-line">
        <p className="gk-hint mb-2">
          {plan.baseline.date} 기준점 {formatEok(plan.baseline.amount)}원에서 월 {formatEok(plan.monthlyContribution)}원을
          넣었을 때 지금 있어야 할 금액 (실제 납입이 다르면 차이에 함께 섞입니다)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {paths.map((path) => (
            <div key={path.label} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink-muted">
                {path.label} {formatEok(path.expected)}원
              </span>
              <span className={`font-medium ${path.gap >= 0 ? 'text-gain' : 'text-loss'}`}>
                {path.gap >= 0 ? '+' : ''}
                {formatEok(path.gap)}원
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    <p className="gk-hint mt-4 pt-3 border-t border-line">
      가정: 월 {formatEok(plan.monthlyContribution)}원 납입, 연 {(plan.expectedAnnualReturn * 100).toFixed(1)}% 수익 ·
      손실 한도 -{(plan.maxDrawdown * 100).toFixed(0)}%: 지금 기준 {formatEok(drawdownFloor)}원 아래로 내려가면 점검
    </p>

  </>;
}
