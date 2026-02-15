import { z } from 'zod';
import {
  CURRENCIES,
  GRANARY_PURPOSES,
  DEFAULT_OWNER,
  JUDGMENT_ACTIONS,
  JUDGMENT_ASSET_TYPES,
  JUDGMENT_EMOTION_STATES,
  JUDGMENT_TIME_HORIZONS,
  JUDGMENT_STRATEGY_TAGS,
  JUDGMENT_REF_TYPES,
} from './constants';

export const GranarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  purpose: z.enum(GRANARY_PURPOSES),
  currency: z.enum(CURRENCIES),
  owner: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SnapshotSchema = z.object({
  id: z.string().uuid(),
  granaryId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAmount: z.number().nonnegative(),
  availableBalance: z.number().nonnegative().optional(),
  profitLoss: z.number().optional(),
  memo: z.string().max(500).optional(),
  createdAt: z.string().datetime(),
});

export const CreateGranarySchema = z.object({
  name: z.string().min(1).max(100),
  purpose: z.enum(GRANARY_PURPOSES),
  currency: z.enum(CURRENCIES),
  owner: z.string().min(1).default(DEFAULT_OWNER),
});

export const UpdateGranarySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  purpose: z.enum(GRANARY_PURPOSES).optional(),
  currency: z.enum(CURRENCIES).optional(),
});

export const CreateSnapshotSchema = z.object({
  granaryId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAmount: z.number().nonnegative(),
  availableBalance: z.number().nonnegative().optional(),
  profitLoss: z.number().optional(),
  memo: z.string().max(500).optional(),
});

export const UpdateSnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  totalAmount: z.number().nonnegative().optional(),
  availableBalance: z.number().nonnegative().optional().nullable(),
  profitLoss: z.number().optional().nullable(),
  memo: z.string().max(500).optional().nullable(),
});

export const JudgmentDiaryAssetSchema = z.object({
  type: z.enum(JUDGMENT_ASSET_TYPES),
  tickerOrName: z.string().min(1).max(50),
});

export const JudgmentDiaryPositionChangeSchema = z.object({
  asset: z.string().min(1).max(50),
  fromPct: z.number().min(0).max(100).nullable(),
  toPct: z.number().min(0).max(100).nullable(),
  note: z.string().max(200).nullable(),
});

export const JudgmentDiaryRefSchema = z.object({
  type: z.enum(JUDGMENT_REF_TYPES),
  value: z.string().min(1).max(2000),
});

export const JudgmentDiaryEntrySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  action: z.enum(JUDGMENT_ACTIONS),
  marketContext: z.string().max(5000).nullable(),
  decision: z.string().max(5000).nullable(),
  assets: z.array(JudgmentDiaryAssetSchema).optional(),
  positionChange: z.array(JudgmentDiaryPositionChangeSchema).optional(),
  risk: z.string().max(5000).nullable(),
  invalidateConditions: z.array(z.string().min(1).max(500)).optional(),
  nextCheck: z.string().datetime().nullable(),
  emotionState: z.enum(JUDGMENT_EMOTION_STATES).nullable(),
  confidence: z.number().int().min(1).max(5).nullable(),
  timeHorizon: z.enum(JUDGMENT_TIME_HORIZONS).nullable(),
  strategyTags: z.array(z.enum(JUDGMENT_STRATEGY_TAGS)).optional(),
  refs: z.array(JudgmentDiaryRefSchema).optional(),
  disclaimerVisible: z.boolean().default(true),
  reviewedAt: z.string().datetime().nullable(),
  outcome: z.string().max(5000).nullable(),
  whatWasRight: z.string().max(5000).nullable(),
  whatWasWrong: z.string().max(5000).nullable(),
  lesson: z.string().max(5000).nullable(),
  nextAction: z.string().max(5000).nullable(),
});

export const CreateJudgmentDiaryEntrySchema = z.object({
  createdAt: z.string().datetime().optional(),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  action: z.enum(JUDGMENT_ACTIONS),
  marketContext: z.string().max(5000).nullable().optional(),
  decision: z.string().max(5000).nullable().optional(),
  assets: z.array(JudgmentDiaryAssetSchema).optional(),
  positionChange: z.array(JudgmentDiaryPositionChangeSchema).optional(),
  risk: z.string().max(5000).nullable().optional(),
  invalidateConditions: z.array(z.string().min(1).max(500)).optional(),
  nextCheck: z.string().datetime().nullable().optional(),
  emotionState: z.enum(JUDGMENT_EMOTION_STATES).nullable().optional(),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  timeHorizon: z.enum(JUDGMENT_TIME_HORIZONS).nullable().optional(),
  strategyTags: z.array(z.enum(JUDGMENT_STRATEGY_TAGS)).optional(),
  refs: z.array(JudgmentDiaryRefSchema).optional(),
  disclaimerVisible: z.boolean().default(true).optional(),
  reviewedAt: z.string().datetime().nullable().optional(),
  outcome: z.string().max(5000).nullable().optional(),
  whatWasRight: z.string().max(5000).nullable().optional(),
  whatWasWrong: z.string().max(5000).nullable().optional(),
  lesson: z.string().max(5000).nullable().optional(),
  nextAction: z.string().max(5000).nullable().optional(),
});

export const UpdateJudgmentDiaryEntrySchema = JudgmentDiaryEntrySchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Granary = z.infer<typeof GranarySchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type CreateGranary = z.infer<typeof CreateGranarySchema>;
export type CreateSnapshot = z.infer<typeof CreateSnapshotSchema>;
export type UpdateGranary = z.infer<typeof UpdateGranarySchema>;
export type UpdateSnapshot = z.infer<typeof UpdateSnapshotSchema>;
export type JudgmentDiaryAsset = z.infer<typeof JudgmentDiaryAssetSchema>;
export type JudgmentDiaryPositionChange = z.infer<typeof JudgmentDiaryPositionChangeSchema>;
export type JudgmentDiaryRef = z.infer<typeof JudgmentDiaryRefSchema>;
export type JudgmentDiaryEntry = z.infer<typeof JudgmentDiaryEntrySchema>;
export type CreateJudgmentDiaryEntry = z.infer<typeof CreateJudgmentDiaryEntrySchema>;
export type UpdateJudgmentDiaryEntry = z.infer<typeof UpdateJudgmentDiaryEntrySchema>;
