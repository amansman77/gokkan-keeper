-- Durable transition delivery. Payload and rule state are committed together.
CREATE TABLE gk_alert_outbox (
 alert_key TEXT NOT NULL PRIMARY KEY,
 symbol TEXT NOT NULL,
 rule_id TEXT NOT NULL,
 date TEXT NOT NULL,
 priority TEXT NOT NULL,
 status TEXT NOT NULL,
 action TEXT,
 indicators_json TEXT NOT NULL CHECK(json_valid(indicators_json)),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
 next_attempt_at INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 delivered_at TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_gk_alert_outbox_pending ON gk_alert_outbox(next_attempt_at, lease_until) WHERE delivered_at IS NULL;
