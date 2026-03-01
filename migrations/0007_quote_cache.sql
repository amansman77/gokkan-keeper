CREATE TABLE IF NOT EXISTS gk_quote_cache (
  cache_key TEXT PRIMARY KEY,
  short_code TEXT NOT NULL,
  operation TEXT NOT NULL,
  quote_json TEXT,
  is_not_found INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gk_quote_cache_short_code ON gk_quote_cache(short_code);
CREATE INDEX IF NOT EXISTS idx_gk_quote_cache_expires_at ON gk_quote_cache(expires_at);
