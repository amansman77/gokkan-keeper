CREATE TABLE IF NOT EXISTS gk_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

INSERT INTO gk_settings (key, value, updated_at) VALUES
  ('weekly_report_rsi_overbought', '70', datetime('now')),
  ('weekly_report_rsi_oversold', '30', datetime('now'));
