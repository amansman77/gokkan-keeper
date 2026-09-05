CREATE TABLE IF NOT EXISTS gk_alert_rule_state (
  symbol         TEXT NOT NULL,
  rule_id        TEXT NOT NULL,
  condition_met  INTEGER NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (symbol, rule_id)
);
