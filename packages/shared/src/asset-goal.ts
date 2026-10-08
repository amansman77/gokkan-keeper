import { z } from 'zod';
import { GRANARY_PURPOSES } from './constants';

/**
 * Asset goal (자산 목표): the owner's target total across their granaries,
 * minus any purposes listed in `excludedPurposes`.
 *
 * Stored as one JSON value in gk_settings under ASSET_GOAL_SETTING_KEY, so it
 * needs no table of its own. Projections compound monthly at the monthly
 * equivalent of `expectedAnnualReturn` and add `monthlyContribution` at each
 * month end — a planning aid, not a forecast.
 */
export const ASSET_GOAL_SETTING_KEY = 'asset_goal_plan';

export const AssetGoalMilestoneSchema = z.object({
  /** The goal is due at the end of this year (12/31). */
  year: z.number().int().min(2000).max(2100),
  /** Target total in KRW. */
  amount: z.number().positive(),
});

export const AssetGoalPlanSchema = z.object({
  milestones: z.array(AssetGoalMilestoneSchema).min(1),
  monthlyContribution: z.number().min(0),
  /** e.g. 0.07 for 7%/year. */
  expectedAnnualReturn: z.number().min(-0.5).max(1),
  /** Tolerated peak-to-trough decline as a positive fraction, e.g. 0.2 for -20%. */
  maxDrawdown: z.number().min(0).max(1),
  /** Granaries with these purposes are left out of the goal total (e.g. children's accounts). */
  excludedPurposes: z.array(z.enum(GRANARY_PURPOSES)).default([]),
  /**
   * Return the strategy aims for, tracked against the plan's conservative
   * `expectedAnnualReturn`. Kept separate on purpose: planning on the
   * aspirational rate would hide a shortfall until it is too late to act.
   */
  targetAnnualReturn: z.number().min(-0.5).max(1).optional(),
  /** Starting point the expected/target paths are measured from. */
  baseline: z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: z.number().min(0) })
    .optional(),
});

export type AssetGoalMilestone = z.infer<typeof AssetGoalMilestoneSchema>;
export type AssetGoalPlan = z.infer<typeof AssetGoalPlanSchema>;

export const DEFAULT_ASSET_GOAL_PLAN: AssetGoalPlan = {
  milestones: [
    { year: 2035, amount: 100_000_000 },
    { year: 2045, amount: 1_000_000_000 },
  ],
  monthlyContribution: 1_000_000,
  expectedAnnualReturn: 0.07,
  maxDrawdown: 0.2,
  excludedPurposes: ['아이들'],
};

export function parseAssetGoalPlan(raw: string | undefined | null): AssetGoalPlan {
  if (!raw) return DEFAULT_ASSET_GOAL_PLAN;
  try {
    const parsed = AssetGoalPlanSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_ASSET_GOAL_PLAN;
  } catch {
    return DEFAULT_ASSET_GOAL_PLAN;
  }
}

/** Fractional months elapsed from an ISO date (YYYY-MM-DD) to `to`; 0 if in the future. */
export function monthsSince(isoDate: string, to: Date = new Date()): number {
  const days = (to.getTime() - new Date(`${isoDate}T00:00:00`).getTime()) / 86_400_000;
  return Math.max(0, days / (365.25 / 12));
}

/** Whole months from `from` until the end of `year`; 0 once that has passed. */
export function monthsUntilYearEnd(year: number, from: Date = new Date()): number {
  const months = (year - from.getFullYear()) * 12 + (11 - from.getMonth());
  return Math.max(0, months);
}

function monthlyRate(annualReturn: number): number {
  return Math.pow(1 + annualReturn, 1 / 12) - 1;
}

/** Value after `months` of growth plus a contribution at each month end. */
export function projectAssetValue(
  current: number,
  monthlyContribution: number,
  annualReturn: number,
  months: number,
): number {
  const r = monthlyRate(annualReturn);
  if (r === 0) return current + monthlyContribution * months;
  const growth = Math.pow(1 + r, months);
  return current * growth + monthlyContribution * ((growth - 1) / r);
}

/** Monthly contribution that reaches `target` in `months`; 0 if already reachable without one. */
export function requiredMonthlyContribution(
  current: number,
  target: number,
  annualReturn: number,
  months: number,
): number {
  if (months <= 0) return current >= target ? 0 : Infinity;
  const r = monthlyRate(annualReturn);
  const growth = Math.pow(1 + r, months);
  const shortfall = target - current * growth;
  if (shortfall <= 0) return 0;
  return r === 0 ? shortfall / months : shortfall / ((growth - 1) / r);
}
