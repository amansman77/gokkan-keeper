CREATE TABLE IF NOT EXISTS gk_alert_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol           TEXT NOT NULL,
  rule_id          TEXT NOT NULL,
  date             TEXT NOT NULL,
  priority         TEXT NOT NULL,
  status           TEXT NOT NULL,
  action           TEXT,
  indicators_json  TEXT,
  sent_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_log_symbol ON gk_alert_log (symbol, rule_id, date);
