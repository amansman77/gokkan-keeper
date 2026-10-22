import {
  AssetGoalPlanSchema,
  type AssetGoalPlan
} from '@gokkan-keeper/shared';
import type { Granary, Snapshot } from '../../lib/types';

export interface AssetGoalProgressProps {
  granaries: (Granary & { latestSnapshot?: Snapshot })[];
}

export function formatEok(amount: number): string {
  if (!Number.isFinite(amount)) return '-';
  const abs = Math.abs(amount);
  if (abs >= 100_000_000) return `${(amount / 100_000_000).toFixed(2)}억`;
  return `${Math.round(amount / 10_000).toLocaleString('ko-KR')}만`;
}

/** Sum of the counted granaries' latest snapshots in KRW; USD granaries use the live USD/KRW rate. */
export function totalInKrw(granaries: AssetGoalProgressProps['granaries'], usdKrw: number | null) {
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

export interface DraftPlan {
  milestones: { year: string; amountEok: string }[];
  monthlyContributionMan: string;
  expectedReturnPct: string;
  maxDrawdownPct: string;
  targetReturnPct: string;
  excludedPurposes: AssetGoalPlan['excludedPurposes'];
}

export function toDraft(plan: AssetGoalPlan): DraftPlan {
  return {
    milestones: plan.milestones.map((m) => ({ year: String(m.year), amountEok: String(m.amount / 100_000_000) })),
    monthlyContributionMan: String(plan.monthlyContribution / 10_000),
    expectedReturnPct: String(plan.expectedAnnualReturn * 100),
    maxDrawdownPct: String(plan.maxDrawdown * 100),
    targetReturnPct: plan.targetAnnualReturn != null ? String(plan.targetAnnualReturn * 100) : '',
    excludedPurposes: plan.excludedPurposes,
  };
}

export function fromDraft(draft: DraftPlan, baseline: AssetGoalPlan['baseline']) {
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

