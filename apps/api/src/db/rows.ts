import type { Granary, Snapshot, Position, JudgmentDiaryEntry, AlertThreshold, CashFlow } from '@gokkan-keeper/shared';

// D1 bind values used by our repositories; boolean flags are stored as 0/1.
export type SqlValue = string | number | null;

export interface GranaryRow {
  id: Exclude<Granary['id'], undefined>;
  name: Exclude<Granary['name'], undefined>;
  purpose: Exclude<Granary['purpose'], undefined>;
  currency: Exclude<Granary['currency'], undefined>;
  owner: Exclude<Granary['owner'], undefined>;
  is_public: number;
  public_thesis: Exclude<Granary['publicThesis'], undefined>;
  public_order: Exclude<Granary['publicOrder'], undefined>;
  last_public_update: Exclude<Granary['lastPublicUpdate'], undefined>;
  created_at: Exclude<Granary['createdAt'], undefined>;
  updated_at: Exclude<Granary['updatedAt'], undefined>;
}

export interface SnapshotRow {
  id: Exclude<Snapshot['id'], undefined>;
  granary_id: Exclude<Snapshot['granaryId'], undefined>;
  date: Exclude<Snapshot['date'], undefined>;
  total_amount: Exclude<Snapshot['totalAmount'], undefined>;
  available_balance: Exclude<Snapshot['availableBalance'], undefined> | null;
  profit_loss: Exclude<Snapshot['profitLoss'], undefined> | null;
  memo: Exclude<Snapshot['memo'], undefined> | null;
  created_at: Exclude<Snapshot['createdAt'], undefined>;
}

export interface PositionRow {
  id: Exclude<Position['id'], undefined>;
  granary_id: Exclude<Position['granaryId'], undefined>;
  name: Exclude<Position['name'], undefined>;
  symbol: Exclude<Position['symbol'], undefined>;
  market: Exclude<Position['market'], undefined>;
  asset_type: Exclude<Position['assetType'], undefined>;
  quantity: Exclude<Position['quantity'], undefined>;
  avg_cost: Exclude<Position['avgCost'], undefined>;
  current_value: Exclude<Position['currentValue'], undefined>;
  weight_percent: Exclude<Position['weightPercent'], undefined>;
  target_weight_percent: Exclude<Position['targetWeightPercent'], undefined>;
  profit_loss: Exclude<Position['profitLoss'], undefined>;
  profit_loss_percent: Exclude<Position['profitLossPercent'], undefined>;
  note: Exclude<Position['note'], undefined>;
  is_public: number;
  public_thesis: Exclude<Position['publicThesis'], undefined>;
  public_order: Exclude<Position['publicOrder'], undefined>;
  last_public_update: Exclude<Position['lastPublicUpdate'], undefined>;
  created_at: Exclude<Position['createdAt'], undefined>;
  updated_at: Exclude<Position['updatedAt'], undefined>;
}

export interface JudgmentDiaryEntryRow {
  id: Exclude<JudgmentDiaryEntry['id'], undefined>;
  created_at: Exclude<JudgmentDiaryEntry['createdAt'], undefined>;
  updated_at: Exclude<JudgmentDiaryEntry['updatedAt'], undefined>;
  title: Exclude<JudgmentDiaryEntry['title'], undefined>;
  summary: Exclude<JudgmentDiaryEntry['summary'], undefined>;
  main_content: Exclude<JudgmentDiaryEntry['mainContent'], undefined> | null;
  market_context: Exclude<JudgmentDiaryEntry['marketContext'], undefined>;
  decision: Exclude<JudgmentDiaryEntry['decision'], undefined>;
  action: Exclude<JudgmentDiaryEntry['action'], undefined>;
  risk: Exclude<JudgmentDiaryEntry['risk'], undefined>;
  next_check: Exclude<JudgmentDiaryEntry['nextCheck'], undefined>;
  emotion_state: Exclude<JudgmentDiaryEntry['emotionState'], undefined>;
  confidence: Exclude<JudgmentDiaryEntry['confidence'], undefined>;
  time_horizon: Exclude<JudgmentDiaryEntry['timeHorizon'], undefined>;
  disclaimer_visible: number;
  reviewed_at: Exclude<JudgmentDiaryEntry['reviewedAt'], undefined>;
  outcome: Exclude<JudgmentDiaryEntry['outcome'], undefined>;
  what_was_right: Exclude<JudgmentDiaryEntry['whatWasRight'], undefined>;
  what_was_wrong: Exclude<JudgmentDiaryEntry['whatWasWrong'], undefined>;
  lesson: Exclude<JudgmentDiaryEntry['lesson'], undefined>;
  next_action: Exclude<JudgmentDiaryEntry['nextAction'], undefined>;
  assets_json: string | null;
  position_change_json: string | null;
  invalidate_conditions_json: string | null;
  strategy_tags_json: string | null;
  refs_json: string | null;
}

export interface AlertThresholdRow {
  id: Exclude<AlertThreshold['id'], undefined>;
  symbol: Exclude<AlertThreshold['symbol'], undefined>;
  label: Exclude<AlertThreshold['label'], undefined>;
  direction: Exclude<AlertThreshold['direction'], undefined>;
  threshold: Exclude<AlertThreshold['threshold'], undefined>;
  enabled: number;
  created_at: Exclude<AlertThreshold['createdAt'], undefined>;
  updated_at: Exclude<AlertThreshold['updatedAt'], undefined>;
}

export interface CashFlowRow {
  id: Exclude<CashFlow['id'], undefined>;
  granary_id: Exclude<CashFlow['granaryId'], undefined>;
  date: Exclude<CashFlow['date'], undefined>;
  type: Exclude<CashFlow['type'], undefined>;
  amount: Exclude<CashFlow['amount'], undefined>;
  memo: Exclude<CashFlow['memo'], undefined>;
  created_at: Exclude<CashFlow['createdAt'], undefined>;
  updated_at: Exclude<CashFlow['updatedAt'], undefined>;
}
