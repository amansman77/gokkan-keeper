ALTER TABLE gk_granaries ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gk_granaries ADD COLUMN public_thesis TEXT;
ALTER TABLE gk_granaries ADD COLUMN public_order INTEGER;
ALTER TABLE gk_granaries ADD COLUMN last_public_update TEXT;

CREATE INDEX IF NOT EXISTS idx_gk_granaries_is_public ON gk_granaries(is_public);
CREATE INDEX IF NOT EXISTS idx_gk_granaries_public_order ON gk_granaries(public_order);

CREATE TABLE IF NOT EXISTS gk_positions (
  id TEXT PRIMARY KEY,
  granary_id TEXT,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  market TEXT,
  asset_type TEXT,
  quantity REAL,
  avg_cost REAL,
  current_value REAL,
  weight_percent REAL,
  profit_loss REAL,
  profit_loss_percent REAL,
  note TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  public_thesis TEXT,
  public_order INTEGER NOT NULL DEFAULT 0,
  last_public_update TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (granary_id) REFERENCES gk_granaries(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_positions_granary_id ON gk_positions(granary_id);
CREATE INDEX IF NOT EXISTS idx_positions_is_public ON gk_positions(is_public);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON gk_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_public_order ON gk_positions(public_order);
CREATE INDEX IF NOT EXISTS idx_positions_weight_percent ON gk_positions(weight_percent);
