import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JudgmentDiaryEntrySchema, getPositionMarketValue } from '@gokkan-keeper/shared';
import { parseJSON, transformJudgmentDiaryEntry, transformPosition, transformSnapshot } from '../../src/db/mappers';
import type { JudgmentDiaryEntryRow, PositionRow } from '../../src/db/rows';

const entry: JudgmentDiaryEntryRow = {
  id: 'entry', created_at: '2026-10-09T00:00:00Z', updated_at: '2026-10-09T00:00:00Z',
  title: 'Candidate pool', summary: 'Original decision', main_content: null, action: 'WATCH',
  market_context: null, decision: null, risk: null, next_check: null, emotion_state: null,
  confidence: null, time_horizon: null, disclaimer_visible: 1, reviewed_at: null,
  outcome: null, what_was_right: null, what_was_wrong: null, lesson: null, next_action: null,
  assets_json: '[{"type":"STOCK","tickerOrName":"257720.KQ"}]',
  position_change_json: '[]', invalidate_conditions_json: '[]', strategy_tags_json: null, refs_json: null,
};
void test('diary assets used by external automation survive DB mapping and legacy content fallback', () => {
  const mapped = transformJudgmentDiaryEntry(entry);
  assert.deepEqual(mapped.assets, [{ type: 'STOCK', tickerOrName: '257720.KQ' }]);
  assert.equal(mapped.mainContent, entry.summary);
  assert.equal(mapped.reviewedAt, null);
});
void test('malformed and structurally invalid DB JSON are absent instead of escaping into DTOs', () => {
  for (const json of ['{', 'null', '42', '{}', '[{"type":"INVALID","tickerOrName":"A"}]']) {
    assert.equal(parseJSON(json, JudgmentDiaryEntrySchema.shape.assets), undefined);
  }
  assert.deepEqual(parseJSON('[]', JudgmentDiaryEntrySchema.shape.assets), []);
});
const position: PositionRow = {
  id: 'position', granary_id: null, name: 'Asset', symbol: 'TEST', market: null, asset_type: null,
  quantity: 2, avg_cost: null, current_value: 10, weight_percent: null, target_weight_percent: null,
  profit_loss: null, profit_loss_percent: null, note: null, is_public: 0, public_thesis: null,
  public_order: 0, last_public_update: null, created_at: '2026-10-09', updated_at: '2026-10-09',
};
void test('mapping preserves the legacy currentValue semantics including zero quantity', () => {
  for (const [quantity, expected] of [[2, 20], [0, 0], [null, 10]] as const) {
    const mapped = transformPosition({ ...position, quantity });
    assert.equal(mapped.currentValue, 10);
    assert.equal(mapped.isPublic, false);
    assert.equal(getPositionMarketValue(mapped), expected);
  }
});
void test('snapshot SQL NULL fields preserve the existing response contract', () => {
  const mapped = transformSnapshot({ id: 'snapshot', granary_id: 'granary', date: '2026-10-09',
    total_amount: 100, available_balance: null, profit_loss: null, memo: null, created_at: '2026-10-09' });
  assert.equal(mapped.availableBalance, null);
  assert.equal(mapped.profitLoss, null);
  assert.equal(mapped.memo, null);
});
