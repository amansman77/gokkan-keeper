CREATE TABLE IF NOT EXISTS gk_cash_flows (
  id          TEXT PRIMARY KEY,
  granary_id  TEXT NOT NULL REFERENCES gk_granaries(id),
  date        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL')),
  amount      REAL NOT NULL,
  memo        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cash_flows_granary_id ON gk_cash_flows (granary_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_date ON gk_cash_flows (date);
