CREATE TABLE gk_sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX gk_sessions_expiry ON gk_sessions(expires_at);

CREATE TABLE gk_security_rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX gk_security_rate_limits_expiry ON gk_security_rate_limits(expires_at);

CREATE TABLE gk_security_audit_log (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  domain TEXT NOT NULL,
  method TEXT NOT NULL,
  status INTEGER NOT NULL
);
CREATE INDEX gk_security_audit_log_created ON gk_security_audit_log(created_at);
