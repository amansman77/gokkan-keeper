CREATE TABLE IF NOT EXISTS gk_alert_thresholds (
  id          TEXT PRIMARY KEY,
  symbol      TEXT NOT NULL,
  label       TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('below', 'above')),
  threshold   REAL NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_symbol ON gk_alert_thresholds (symbol);
