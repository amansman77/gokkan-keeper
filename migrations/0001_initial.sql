-- Create granaries table (with gk_ prefix for multi-service database)
CREATE TABLE IF NOT EXISTS gk_granaries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  currency TEXT NOT NULL,
  owner TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create snapshots table (with gk_ prefix for multi-service database)
CREATE TABLE IF NOT EXISTS gk_snapshots (
  id TEXT PRIMARY KEY,
  granary_id TEXT NOT NULL,
  date TEXT NOT NULL,
  total_amount REAL NOT NULL,
  available_balance REAL,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (granary_id) REFERENCES gk_granaries(id) ON DELETE CASCADE,
  UNIQUE(granary_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gk_snapshots_granary_date ON gk_snapshots(granary_id, date);
CREATE INDEX IF NOT EXISTS idx_gk_granaries_name ON gk_granaries(name);
CREATE INDEX IF NOT EXISTS idx_gk_granaries_owner ON gk_granaries(owner);

