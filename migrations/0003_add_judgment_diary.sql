-- Create judgment diary entries table
CREATE TABLE IF NOT EXISTS gk_judgment_diary_entries (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  market_context TEXT NOT NULL,
  decision TEXT NOT NULL,
  action TEXT NOT NULL,
  assets_json TEXT NOT NULL,
  position_change_json TEXT NOT NULL,
  risk TEXT NOT NULL,
  invalidate_conditions_json TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_gk_judgment_diary_created_at ON gk_judgment_diary_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_gk_judgment_diary_action ON gk_judgment_diary_entries(action);
