-- Rebuild judgment diary entries table for v2 light
ALTER TABLE gk_judgment_diary_entries RENAME TO gk_judgment_diary_entries_old;

CREATE TABLE gk_judgment_diary_entries (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  action TEXT NOT NULL,
  market_context TEXT,
  decision TEXT,
  assets_json TEXT NOT NULL DEFAULT '[]',
  position_change_json TEXT NOT NULL DEFAULT '[]',
  risk TEXT,
  invalidate_conditions_json TEXT NOT NULL DEFAULT '[]',
  next_check TEXT,
  emotion_state TEXT,
  confidence INTEGER,
  time_horizon TEXT,
  strategy_tags_json TEXT,
  refs_json TEXT,
  disclaimer_visible INTEGER NOT NULL DEFAULT 1,
  reviewed_at TEXT,
  outcome TEXT,
  what_was_right TEXT,
  what_was_wrong TEXT,
  lesson TEXT,
  next_action TEXT
);

INSERT INTO gk_judgment_diary_entries (
  id,
  created_at,
  updated_at,
  title,
  summary,
  action,
  market_context,
  decision,
  assets_json,
  position_change_json,
  risk,
  invalidate_conditions_json,
  next_check,
  emotion_state,
  confidence,
  time_horizon,
  strategy_tags_json,
  refs_json,
  disclaimer_visible,
  reviewed_at,
  outcome,
  what_was_right,
  what_was_wrong,
  lesson,
  next_action
)
SELECT
  id,
  created_at,
  updated_at,
  title,
  summary,
  action,
  market_context,
  decision,
  COALESCE(assets_json, '[]'),
  COALESCE(position_change_json, '[]'),
  risk,
  COALESCE(invalidate_conditions_json, '[]'),
  next_check,
  emotion_state,
  confidence,
  time_horizon,
  strategy_tags_json,
  refs_json,
  disclaimer_visible,
  reviewed_at,
  outcome,
  what_was_right,
  what_was_wrong,
  lesson,
  next_action
FROM gk_judgment_diary_entries_old;

DROP TABLE gk_judgment_diary_entries_old;

CREATE INDEX IF NOT EXISTS idx_gk_judgment_diary_created_at ON gk_judgment_diary_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_gk_judgment_diary_action ON gk_judgment_diary_entries(action);
