import { JudgmentDiaryEntrySchema } from '@gokkan-keeper/shared';
import type { GranaryRow, SnapshotRow, PositionRow, JudgmentDiaryEntryRow } from './rows';
import type {
  Granary,
  JudgmentDiaryEntry,
  Position,
  Snapshot,
} from '@gokkan-keeper/shared';

export function transformGranary(row: GranaryRow): Granary {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    currency: row.currency,
    owner: row.owner,
    isPublic: row.is_public === 1,
    publicThesis: row.public_thesis ?? null,
    publicOrder: row.public_order ?? null,
    lastPublicUpdate: row.last_public_update ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function transformSnapshot(row: SnapshotRow): Snapshot {
  return {
    id: row.id,
    granaryId: row.granary_id,
    date: row.date,
    totalAmount: row.total_amount,
    availableBalance: row.available_balance,
    profitLoss: row.profit_loss,
    memo: row.memo,
    createdAt: row.created_at,
  };
}

export function transformPosition(row: PositionRow): Position {
  return {
    id: row.id,
    granaryId: row.granary_id ?? null,
    name: row.name,
    symbol: row.symbol,
    market: row.market ?? null,
    assetType: row.asset_type ?? null,
    quantity: row.quantity ?? null,
    avgCost: row.avg_cost ?? null,
    currentValue: row.current_value ?? null,
    weightPercent: row.weight_percent ?? null,
    targetWeightPercent: row.target_weight_percent ?? null,
    profitLoss: row.profit_loss ?? null,
    profitLossPercent: row.profit_loss_percent ?? null,
    note: row.note ?? null,
    isPublic: row.is_public === 1,
    publicThesis: row.public_thesis ?? null,
    publicOrder: row.public_order ?? 0,
    lastPublicUpdate: row.last_public_update ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Validate JSON against the same contracts used at the API write boundary.
// Invalid legacy JSON remains absent, as malformed JSON did before.
export function parseJSON<T>(value: string | null, schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } }): T | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function transformJudgmentDiaryEntry(row: JudgmentDiaryEntryRow): JudgmentDiaryEntry {
  const mainContent = typeof row.main_content === 'string' && row.main_content.trim()
    ? row.main_content
    : row.summary;

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    summary: row.summary,
    mainContent,
    marketContext: row.market_context ?? null,
    decision: row.decision ?? null,
    action: row.action,
    assets: parseJSON(row.assets_json, JudgmentDiaryEntrySchema.shape.assets),
    positionChange: parseJSON(row.position_change_json, JudgmentDiaryEntrySchema.shape.positionChange),
    risk: row.risk ?? null,
    invalidateConditions: parseJSON(row.invalidate_conditions_json, JudgmentDiaryEntrySchema.shape.invalidateConditions),
    nextCheck: row.next_check,
    emotionState: row.emotion_state,
    confidence: row.confidence,
    timeHorizon: row.time_horizon,
    strategyTags: parseJSON(row.strategy_tags_json, JudgmentDiaryEntrySchema.shape.strategyTags),
    refs: parseJSON(row.refs_json, JudgmentDiaryEntrySchema.shape.refs),
    disclaimerVisible: row.disclaimer_visible === 1,
    reviewedAt: row.reviewed_at,
    outcome: row.outcome,
    whatWasRight: row.what_was_right,
    whatWasWrong: row.what_was_wrong,
    lesson: row.lesson,
    nextAction: row.next_action,
  };
}

export function toSafeLimit(limit: number, fallback: number, max: number): number {
  const value = Number.isFinite(limit) ? limit : fallback;
  return Math.min(Math.max(value, 1), max);
}
