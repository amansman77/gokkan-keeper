import { useEffect, useState } from 'react';
import {
  ASSET_GOAL_SETTING_KEY,
  GRANARY_PURPOSES,
  AssetGoalPlanSchema,
  monthsSince,
  monthsUntilYearEnd,
  parseAssetGoalPlan,
  projectAssetValue,
  requiredMonthlyContribution,
  type AssetGoalPlan,
} from '@gokkan-keeper/shared';
import { getMarketIndices, getSettings, updateSetting } from '../lib/api';
import type { Granary, Snapshot } from '../lib/types';

interface AssetGoalProgressProps {
  granaries: (Granary & { latestSnapshot?: Snapshot })[];
}

function formatEok(amount: number): string {
  if (!Number.isFinite(amount)) return '-';
  const abs = Math.abs(amount);
  if (abs >= 100_000_000) return `${(amount / 100_000_000).toFixed(2)}억`;
  return `${Math.round(amount / 10_000).toLocaleString('ko-KR')}만`;
}

/** Sum of the counted granaries' latest snapshots in KRW; USD granaries use the live USD/KRW rate. */
function totalInKrw(granaries: AssetGoalProgressProps['granaries'], usdKrw: number | null) {
  let total = 0;
  const excluded: string[] = [];
  for (const granary of granaries) {
    const amount = granary.latestSnapshot?.totalAmount;
    if (amount == null) continue;
    if (granary.currency === 'KRW') total += amount;
    else if (granary.currency === 'USD' && usdKrw) total += amount * usdKrw;
    else excluded.push(granary.name);
  }
  return { total, excluded };
}

interface DraftPlan {
  milestones: { year: string; amountEok: string }[];
  monthlyContributionMan: string;
  expectedReturnPct: string;
  maxDrawdownPct: string;
  targetReturnPct: string;
  excludedPurposes: AssetGoalPlan['excludedPurposes'];
}

function toDraft(plan: AssetGoalPlan): DraftPlan {
  return {
    milestones: plan.milestones.map((m) => ({ year: String(m.year), amountEok: String(m.amount / 100_000_000) })),
    monthlyContributionMan: String(plan.monthlyContribution / 10_000),
    expectedReturnPct: String(plan.expectedAnnualReturn * 100),
    maxDrawdownPct: String(plan.maxDrawdown * 100),
    targetReturnPct: plan.targetAnnualReturn != null ? String(plan.targetAnnualReturn * 100) : '',
    excludedPurposes: plan.excludedPurposes,
  };
}

function fromDraft(draft: DraftPlan, baseline: AssetGoalPlan['baseline']) {
  return AssetGoalPlanSchema.safeParse({
    milestones: draft.milestones
      .map((m) => ({ year: Number(m.year), amount: Number(m.amountEok) * 100_000_000 }))
      .sort((a, b) => a.year - b.year),
    monthlyContribution: Number(draft.monthlyContributionMan) * 10_000,
    expectedAnnualReturn: Number(draft.expectedReturnPct) / 100,
    maxDrawdown: Number(draft.maxDrawdownPct) / 100,
    excludedPurposes: draft.excludedPurposes,
    targetAnnualReturn: draft.targetReturnPct.trim() === '' ? undefined : Number(draft.targetReturnPct) / 100,
    baseline,
  });
}

export default function AssetGoalProgress({ granaries }: AssetGoalProgressProps) {
  const [plan, setPlan] = useState<AssetGoalPlan | null>(null);
  const [usdKrw, setUsdKrw] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSettings(), getMarketIndices().catch(() => null)])
      .then(([settings, market]) => {
        setPlan(parseAssetGoalPlan(settings[ASSET_GOAL_SETTING_KEY]));
        setUsdKrw(market?.indices.find((index) => index.symbol === 'KRW=X')?.value ?? null);
      })
      .catch((err) => setError(err.message || '목표를 불러오는데 실패했습니다.'));
  }, []);

  if (!plan) {
    return error ? <p className="text-sm text-danger">{error}</p> : null;
  }

  const counted = granaries.filter((g) => !plan.excludedPurposes.includes(g.purpose));
  const { total, excluded } = totalInKrw(counted, usdKrw);
  const hasUsd = counted.some((g) => g.currency === 'USD' && g.latestSnapshot);

  async function savePlan(next: AssetGoalPlan) {
    setSaving(true);
    setError(null);
    try {
      await updateSetting(ASSET_GOAL_SETTING_KEY, JSON.stringify(next));
      setPlan(next);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || '목표 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !plan) return;
    const parsed = fromDraft(draft, plan.baseline);
    if (!parsed.success) {
      setError('입력값을 확인해 주세요. 연도와 금액은 양수여야 합니다.');
      return;
    }
    await savePlan(parsed.data);
  }

  function handleResetBaseline() {
    if (!plan) return;
    const today = new Date().toISOString().slice(0, 10);
    if (!window.confirm(`오늘(${today}) 합계 ${formatEok(total)}원을 경로 기준점으로 저장할까요?`)) return;
    void savePlan({ ...plan, baseline: { date: today, amount: Math.round(total) } });
  }

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

  return (
    <div className="bg-surface rounded-lg shadow p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-faint">자산 목표</h2>
        <button
          type="button"
          onClick={() => {
            setDraft(toDraft(plan));
            setEditing(!editing);
            setError(null);
          }}
          className="text-xs text-accent hover:underline"
        >
          {editing ? '닫기' : '목표 수정'}
        </button>
      </div>

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

      {editing && draft && (
        <form onSubmit={handleSave} className="mt-4 pt-4 border-t border-line space-y-3">
          {draft.milestones.map((m, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3">
              <div className="gk-field">
                <label className="gk-label-sm">목표 연도</label>
                <input
                  type="number"
                  value={m.year}
                  onChange={(e) => {
                    const milestones = [...draft.milestones];
                    milestones[i] = { ...m, year: e.target.value };
                    setDraft({ ...draft, milestones });
                  }}
                  className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
                />
              </div>
              <div className="gk-field">
                <label className="gk-label-sm">목표 금액(억원)</label>
                <input
                  type="number"
                  step="any"
                  value={m.amountEok}
                  onChange={(e) => {
                    const milestones = [...draft.milestones];
                    milestones[i] = { ...m, amountEok: e.target.value };
                    setDraft({ ...draft, milestones });
                  }}
                  className="border border-line rounded-md px-2 py-1.5 text-sm w-28"
                />
              </div>
              {draft.milestones.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, milestones: draft.milestones.filter((_, j) => j !== i) })}
                  className="text-xs text-ink-muted hover:underline pb-2"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraft({ ...draft, milestones: [...draft.milestones, { year: '', amountEok: '' }] })}
            className="text-xs text-accent hover:underline"
          >
            + 목표 추가
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="gk-label-sm">합계에서 제외할 곳간 목적</span>
            {GRANARY_PURPOSES.map((purpose) => (
              <label key={purpose} className="flex items-center gap-1 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={draft.excludedPurposes.includes(purpose)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      excludedPurposes: e.target.checked
                        ? [...draft.excludedPurposes, purpose]
                        : draft.excludedPurposes.filter((p) => p !== purpose),
                    })
                  }
                />
                {purpose}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="gk-field">
              <label className="gk-label-sm">월 납입(만원)</label>
              <input
                type="number"
                step="any"
                value={draft.monthlyContributionMan}
                onChange={(e) => setDraft({ ...draft, monthlyContributionMan: e.target.value })}
                className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
              />
            </div>
            <div className="gk-field">
              <label className="gk-label-sm">기대 수익률(연 %)</label>
              <input
                type="number"
                step="any"
                value={draft.expectedReturnPct}
                onChange={(e) => setDraft({ ...draft, expectedReturnPct: e.target.value })}
                className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
              />
            </div>
            <div className="gk-field">
              <label className="gk-label-sm">전략 목표 수익률(연 %)</label>
              <input
                type="number"
                step="any"
                value={draft.targetReturnPct}
                onChange={(e) => setDraft({ ...draft, targetReturnPct: e.target.value })}
                className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
              />
            </div>
            <div className="gk-field">
              <label className="gk-label-sm">손실 한도(%)</label>
              <input
                type="number"
                step="any"
                value={draft.maxDrawdownPct}
                onChange={(e) => setDraft({ ...draft, maxDrawdownPct: e.target.value })}
                className="border border-line rounded-md px-2 py-1.5 text-sm w-24"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-accent text-accent-contrast px-4 py-1.5 rounded-md text-sm font-medium hover:bg-accent-ink disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              type="button"
              onClick={handleResetBaseline}
              disabled={saving || (hasUsd && !usdKrw) || excluded.length > 0}
              className="px-3 py-1.5 text-sm text-ink-muted border border-line rounded-md hover:bg-surface-2 disabled:opacity-50"
            >
              경로 기준점을 오늘로
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </div>
  );
}
